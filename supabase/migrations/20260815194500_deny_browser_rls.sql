do $$
declare t text;
begin
  foreach t in array array[
    'auth_nonces','credit_accounts','leaderboard','ledger_entries',
    'match_moments','match_participants','matches','parties',
    'party_members','players','replay_events','sessions'
  ]
  loop
    execute format('drop policy if exists clashr_no_direct_access on public.%I', t);
    execute format(
      'create policy clashr_no_direct_access on public.%I for all to anon, authenticated using (false) with check (false)',
      t
    );
  end loop;
end $$;
