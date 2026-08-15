//! Per-match SOL escrow.
//!
//! PDA seeds: `["arcade-match", party_id_32]`
//!
//! Instructions:
//! 0 create  — host opens the match account
//! 1 join    — player deposits `entry_lamports`
//! 2 withdraw — player leaves while status is Open
//! 3 lock    — host freezes deposits/withdrawals (match start)
//! 4 settle  — treasury/oracle pays winner − fee, or treasury if a bot won

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    system_program,
    sysvar::Sysvar,
};

entrypoint!(process_instruction);

pub const MAGIC: &[u8; 8] = b"ARCESC01";
pub const SEED: &[u8] = b"arcade-match";
pub const MAX_PLAYERS: usize = 20;
pub const MATCH_SIZE: usize = 8  // magic
    + 32 // authority
    + 32 // treasury
    + 32 // party_id
    + 8  // entry_lamports
    + 2  // fee_bps
    + 1  // capacity
    + 1  // player_count
    + 1  // status
    + 1  // bump
    + 4  // pad
    + 32 * MAX_PLAYERS;

pub const STATUS_OPEN: u8 = 0;
pub const STATUS_LOCKED: u8 = 1;
pub const STATUS_SETTLED: u8 = 2;

const OFF_MAGIC: usize = 0;
const OFF_AUTH: usize = 8;
const OFF_TREASURY: usize = 40;
const OFF_PARTY: usize = 72;
const OFF_ENTRY: usize = 104;
const OFF_FEE: usize = 112;
const OFF_CAP: usize = 114;
const OFF_COUNT: usize = 115;
const OFF_STATUS: usize = 116;
const OFF_BUMP: usize = 117;
const OFF_PLAYERS: usize = 122;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    if data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }
    match data[0] {
        0 => create_match(program_id, accounts, &data[1..]),
        1 => join_match(program_id, accounts),
        2 => withdraw(program_id, accounts),
        3 => lock_match(program_id, accounts),
        4 => settle(program_id, accounts, &data[1..]),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

fn create_match(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    // entry u64, capacity u8, fee_bps u16, party_id [u8;32]
    if data.len() < 8 + 1 + 2 + 32 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let entry = u64::from_le_bytes(data[0..8].try_into().unwrap());
    let capacity = data[8];
    let fee_bps = u16::from_le_bytes(data[9..11].try_into().unwrap());
    let mut party_id = [0u8; 32];
    party_id.copy_from_slice(&data[11..43]);

    if entry == 0 || capacity == 0 || capacity as usize > MAX_PLAYERS || fee_bps > 2000 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let acc = &mut accounts.iter();
    let host = next_account_info(acc)?;
    let pda = next_account_info(acc)?;
    let treasury = next_account_info(acc)?;
    let system = next_account_info(acc)?;

    if !host.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if *system.key != system_program::id() {
        return Err(ProgramError::IncorrectProgramId);
    }

    let (expected, bump) = Pubkey::find_program_address(&[SEED, &party_id], program_id);
    if expected != *pda.key {
        return Err(ProgramError::InvalidSeeds);
    }
    if pda.lamports() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let rent = Rent::get()?.minimum_balance(MATCH_SIZE);
    invoke_signed(
        &system_instruction::create_account(host.key, pda.key, rent, MATCH_SIZE as u64, program_id),
        &[host.clone(), pda.clone(), system.clone()],
        &[&[SEED, &party_id, &[bump]]],
    )?;

    let mut buf = pda.try_borrow_mut_data()?;
    if buf.len() < MATCH_SIZE {
        return Err(ProgramError::AccountDataTooSmall);
    }
    buf[OFF_MAGIC..OFF_MAGIC + 8].copy_from_slice(MAGIC);
    buf[OFF_AUTH..OFF_AUTH + 32].copy_from_slice(host.key.as_ref());
    buf[OFF_TREASURY..OFF_TREASURY + 32].copy_from_slice(treasury.key.as_ref());
    buf[OFF_PARTY..OFF_PARTY + 32].copy_from_slice(&party_id);
    buf[OFF_ENTRY..OFF_ENTRY + 8].copy_from_slice(&entry.to_le_bytes());
    buf[OFF_FEE..OFF_FEE + 2].copy_from_slice(&fee_bps.to_le_bytes());
    buf[OFF_CAP] = capacity;
    buf[OFF_COUNT] = 0;
    buf[OFF_STATUS] = STATUS_OPEN;
    buf[OFF_BUMP] = bump;
    Ok(())
}

fn join_match(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let acc = &mut accounts.iter();
    let player = next_account_info(acc)?;
    let pda = next_account_info(acc)?;
    let system = next_account_info(acc)?;

    if !player.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    assert_match(program_id, pda)?;
    if *system.key != system_program::id() {
        return Err(ProgramError::IncorrectProgramId);
    }

    let (entry, _fee, capacity, count, status, bump, party_id) = meta(pda)?;
    if status != STATUS_OPEN {
        msg!("match not open");
        return Err(ProgramError::InvalidAccountData);
    }
    if count >= capacity {
        return Err(ProgramError::AccountDataTooSmall);
    }

    {
        let data = pda.try_borrow_data()?;
        if player_index(&data, count, player.key).is_some() {
            msg!("already deposited");
            return Err(ProgramError::InvalidAccountData);
        }
    }

    invoke(
        &system_instruction::transfer(player.key, pda.key, entry),
        &[player.clone(), pda.clone(), system.clone()],
    )?;

    let mut data = pda.try_borrow_mut_data()?;
    let idx = count as usize;
    let start = OFF_PLAYERS + idx * 32;
    data[start..start + 32].copy_from_slice(player.key.as_ref());
    data[OFF_COUNT] = count + 1;
    let _ = (bump, party_id);
    Ok(())
}

fn withdraw(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let acc = &mut accounts.iter();
    let player = next_account_info(acc)?;
    let pda = next_account_info(acc)?;

    if !player.is_signer || !player.is_writable {
        return Err(ProgramError::MissingRequiredSignature);
    }
    assert_match(program_id, pda)?;

    let (entry, _fee, _cap, count, status, _bump, _party) = meta(pda)?;
    if status != STATUS_OPEN {
        msg!("cannot withdraw after lock");
        return Err(ProgramError::InvalidAccountData);
    }

    let idx = {
        let data = pda.try_borrow_data()?;
        player_index(&data, count, player.key)
    };
    let idx = idx.ok_or(ProgramError::InvalidAccountData)?;

    debit_pda(pda, player, entry)?;

    let mut data = pda.try_borrow_mut_data()?;
    let last = (count as usize) - 1;
    if idx != last {
        let last_start = OFF_PLAYERS + last * 32;
        let idx_start = OFF_PLAYERS + idx * 32;
        let pk = data[last_start..last_start + 32].to_vec();
        data[idx_start..idx_start + 32].copy_from_slice(&pk);
    }
    let last_start = OFF_PLAYERS + last * 32;
    data[last_start..last_start + 32].fill(0);
    data[OFF_COUNT] = count - 1;
    Ok(())
}

fn lock_match(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let acc = &mut accounts.iter();
    let host = next_account_info(acc)?;
    let pda = next_account_info(acc)?;
    if !host.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    assert_match(program_id, pda)?;
    let data = pda.try_borrow_data()?;
    require_host(&data, host.key)?;
    if data[OFF_STATUS] != STATUS_OPEN {
        return Err(ProgramError::InvalidAccountData);
    }
    drop(data);
    pda.try_borrow_mut_data()?[OFF_STATUS] = STATUS_LOCKED;
    Ok(())
}

fn settle(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    // winner [32] + house u8
    // Settler MUST be the treasury (house/oracle). The match host cannot pay out.
    if data.len() < 33 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let mut winner_pk = [0u8; 32];
    winner_pk.copy_from_slice(&data[0..32]);
    let house = data[32] != 0;

    let acc = &mut accounts.iter();
    let oracle = next_account_info(acc)?;
    let pda = next_account_info(acc)?;
    let treasury = next_account_info(acc)?;
    let winner = next_account_info(acc)?;

    if !oracle.is_signer || !oracle.is_writable {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !pda.is_writable || !treasury.is_writable || !winner.is_writable {
        return Err(ProgramError::InvalidAccountData);
    }
    assert_match(program_id, pda)?;

    let (entry, fee_bps, _cap, count, status, _bump, _party) = meta(pda)?;
    {
        let d = pda.try_borrow_data()?;
        if oracle.key.as_ref() != &d[OFF_TREASURY..OFF_TREASURY + 32] {
            msg!("settle requires the treasury oracle");
            return Err(ProgramError::IllegalOwner);
        }
        if &d[OFF_TREASURY..OFF_TREASURY + 32] != treasury.key.as_ref() {
            return Err(ProgramError::InvalidAccountData);
        }
        if status != STATUS_LOCKED && status != STATUS_OPEN {
            msg!("already settled");
            return Err(ProgramError::InvalidAccountData);
        }
        if !house {
            if winner.key.as_ref() != winner_pk.as_ref() {
                return Err(ProgramError::InvalidAccountData);
            }
            if player_index(&d, count, winner.key).is_none() {
                msg!("winner did not deposit");
                return Err(ProgramError::InvalidAccountData);
            }
        }
    }

    let pot = entry.saturating_mul(count as u64);
    if pot == 0 {
        close_pda(pda, oracle)?;
        return Ok(());
    }

    if house {
        debit_pda(pda, treasury, pot)?;
    } else {
        let fee = pot.saturating_mul(fee_bps as u64) / 10_000;
        let payout = pot.saturating_sub(fee);
        if fee > 0 {
            debit_pda(pda, treasury, fee)?;
        }
        if payout > 0 {
            debit_pda(pda, winner, payout)?;
        }
    }

    {
        let mut d = pda.try_borrow_mut_data()?;
        d[OFF_STATUS] = STATUS_SETTLED;
        d[OFF_COUNT] = 0;
    }
    close_pda(pda, oracle)?;
    Ok(())
}

fn assert_match(program_id: &Pubkey, pda: &AccountInfo) -> ProgramResult {
    if pda.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    let data = pda.try_borrow_data()?;
    if data.len() < MATCH_SIZE || &data[OFF_MAGIC..OFF_MAGIC + 8] != MAGIC {
        return Err(ProgramError::InvalidAccountData);
    }
    let mut party = [0u8; 32];
    party.copy_from_slice(&data[OFF_PARTY..OFF_PARTY + 32]);
    let bump = data[OFF_BUMP];
    drop(data);
    let expected = Pubkey::create_program_address(&[SEED, &party, &[bump]], program_id)
        .map_err(|_| ProgramError::InvalidSeeds)?;
    if expected != *pda.key {
        return Err(ProgramError::InvalidSeeds);
    }
    Ok(())
}

fn meta(pda: &AccountInfo) -> Result<(u64, u16, u8, u8, u8, u8, [u8; 32]), ProgramError> {
    let d = pda.try_borrow_data()?;
    let entry = u64::from_le_bytes(d[OFF_ENTRY..OFF_ENTRY + 8].try_into().unwrap());
    let fee = u16::from_le_bytes(d[OFF_FEE..OFF_FEE + 2].try_into().unwrap());
    let mut party = [0u8; 32];
    party.copy_from_slice(&d[OFF_PARTY..OFF_PARTY + 32]);
    Ok((
        entry,
        fee,
        d[OFF_CAP],
        d[OFF_COUNT],
        d[OFF_STATUS],
        d[OFF_BUMP],
        party,
    ))
}

fn require_host(data: &[u8], host: &Pubkey) -> ProgramResult {
    if &data[OFF_AUTH..OFF_AUTH + 32] != host.as_ref() {
        return Err(ProgramError::IllegalOwner);
    }
    Ok(())
}

fn player_index(data: &[u8], count: u8, key: &Pubkey) -> Option<usize> {
    let bytes = key.as_ref();
    for i in 0..count as usize {
        let start = OFF_PLAYERS + i * 32;
        if &data[start..start + 32] == bytes {
            return Some(i);
        }
    }
    None
}

fn debit_pda(pda: &AccountInfo, dest: &AccountInfo, amount: u64) -> ProgramResult {
    if amount == 0 {
        return Ok(());
    }
    let pda_lamports = pda.lamports();
    if pda_lamports < amount {
        return Err(ProgramError::InsufficientFunds);
    }
    **pda.try_borrow_mut_lamports()? -= amount;
    **dest.try_borrow_mut_lamports()? += amount;
    Ok(())
}

fn close_pda(pda: &AccountInfo, host: &AccountInfo) -> ProgramResult {
    let leftover = pda.lamports();
    if leftover > 0 {
    **pda.try_borrow_mut_lamports()? = 0;
    **host.try_borrow_mut_lamports()? += leftover;
  }
  pda.realloc(0, false)?;
  pda.assign(&system_program::id());
  Ok(())
}
