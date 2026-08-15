-- Applied remotely as public_party_lobbies on project cbfyrkxzgtxoypewdouf.
-- Public waiting parties are listed and joined through RPCs. Anon can SELECT
-- those rows for Realtime, but cannot write the tables directly.

alter table public.parties add column if not exists game_path text;
alter table public.parties add column if not exists escrow_deposits jsonb not null default '[]'::jsonb;

create or replace function public._clashr_ensure_player(
  p_id text, p_username text, p_avatar text, p_color text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.players (id, username, avatar, color)
  values (
    p_id,
    coalesce(nullif(p_username, ''), 'Player'),
    coalesce(nullif(p_avatar, ''), '🗼'),
    coalesce(nullif(p_color, ''), '#22e5ff')
  )
  on conflict (id) do update set
    username = excluded.username,
    avatar = excluded.avatar,
    color = excluded.color,
    updated_at = now();
end;
$$;

create or replace function public.publish_party(
  p_id text, p_game_slug text, p_capacity integer, p_entry integer,
  p_entry_lamports bigint, p_host_id text, p_host_username text,
  p_host_avatar text, p_host_color text, p_visibility text,
  p_escrow_pda text default null, p_escrow_deposits jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  pid text := upper(trim(p_id));
  vis text := case when p_visibility = 'public' then 'public' else 'private' end;
  cap integer := greatest(2, least(20, coalesce(p_capacity, 5)));
begin
  if pid is null or length(pid) < 4 or p_host_id is null or length(p_host_id) < 8 then
    raise exception 'invalid party';
  end if;
  if exists (
    select 1 from public.parties
    where id = pid and host_id <> p_host_id and status = 'waiting'
  ) then
    raise exception 'party code in use';
  end if;

  perform public._clashr_ensure_player(p_host_id, p_host_username, p_host_avatar, p_host_color);

  insert into public.parties (
    id, game_slug, capacity, entry, entry_lamports, host_id, status, visibility,
    escrow_pda, escrow_deposits, updated_at
  ) values (
    pid, case when p_game_slug = 'tower' then 'tower' else 'bomb-party' end,
    cap, greatest(0, coalesce(p_entry, 0)), p_entry_lamports, p_host_id, 'waiting', vis,
    p_escrow_pda, coalesce(p_escrow_deposits, '[]'::jsonb), now()
  )
  on conflict (id) do update set
    game_slug = excluded.game_slug,
    capacity = excluded.capacity,
    entry = excluded.entry,
    entry_lamports = excluded.entry_lamports,
    visibility = excluded.visibility,
    escrow_pda = coalesce(excluded.escrow_pda, public.parties.escrow_pda),
    escrow_deposits = excluded.escrow_deposits,
    status = 'waiting',
    game_path = null,
    updated_at = now()
  where public.parties.host_id = p_host_id;

  insert into public.party_members (party_id, user_id, username, avatar, color, is_host)
  values (
    pid, p_host_id, coalesce(nullif(p_host_username, ''), 'Player'),
    coalesce(nullif(p_host_avatar, ''), '🗼'), coalesce(nullif(p_host_color, ''), '#22e5ff'), true
  )
  on conflict (party_id, user_id) do update set
    username = excluded.username, avatar = excluded.avatar, color = excluded.color, is_host = true;

  return jsonb_build_object('ok', true, 'id', pid);
end;
$$;

create or replace function public.join_party(
  p_id text, p_user_id text, p_username text, p_avatar text, p_color text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  pid text := upper(trim(p_id));
  room public.parties%rowtype;
  filled integer;
begin
  if pid is null or p_user_id is null or length(p_user_id) < 8 then
    raise exception 'invalid join';
  end if;
  select * into room from public.parties where id = pid;
  if not found then raise exception 'party not found'; end if;
  if room.status is distinct from 'waiting' then raise exception 'party already started'; end if;
  perform public._clashr_ensure_player(p_user_id, p_username, p_avatar, p_color);
  select count(*) into filled from public.party_members where party_id = pid;
  if not exists (select 1 from public.party_members where party_id = pid and user_id = p_user_id)
     and filled >= room.capacity then
    raise exception 'party is full';
  end if;
  insert into public.party_members (party_id, user_id, username, avatar, color, is_host)
  values (
    pid, p_user_id, coalesce(nullif(p_username, ''), 'Player'),
    coalesce(nullif(p_avatar, ''), '🗼'), coalesce(nullif(p_color, ''), '#22e5ff'),
    p_user_id = room.host_id
  )
  on conflict (party_id, user_id) do update set
    username = excluded.username, avatar = excluded.avatar, color = excluded.color;
  update public.parties set updated_at = now() where id = pid;
  return jsonb_build_object('ok', true, 'id', pid);
end;
$$;

create or replace function public.leave_party(p_id text, p_user_id text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  pid text := upper(trim(p_id));
  room public.parties%rowtype;
begin
  select * into room from public.parties where id = pid;
  if not found then return jsonb_build_object('ok', true); end if;
  if room.host_id = p_user_id then
    update public.parties set status = 'closed', updated_at = now() where id = pid and status = 'waiting';
    delete from public.party_members where party_id = pid;
  else
    delete from public.party_members where party_id = pid and user_id = p_user_id;
    update public.parties set updated_at = now() where id = pid and status = 'waiting';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.touch_party(p_id text, p_host_id text) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  update public.parties set updated_at = now()
   where id = upper(trim(p_id)) and host_id = p_host_id and status = 'waiting';
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.start_party(p_id text, p_host_id text, p_game_path text) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  update public.parties
     set status = 'live', game_path = p_game_path, updated_at = now()
   where id = upper(trim(p_id)) and host_id = p_host_id and status = 'waiting';
  if not found then raise exception 'cannot start party'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.list_public_parties() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb)
  from (
    select
      p.id, p.game_slug, p.capacity, p.entry, p.entry_lamports, p.host_id,
      coalesce(h.username, 'Host') as host_name,
      (select count(*)::int from public.party_members m where m.party_id = p.id) as member_count,
      (extract(epoch from p.created_at) * 1000)::bigint as created_at
    from public.parties p
    left join public.party_members h on h.party_id = p.id and h.is_host = true
    where p.visibility = 'public'
      and p.status = 'waiting'
      and p.updated_at > now() - interval '3 minutes'
      and (select count(*) from public.party_members m where m.party_id = p.id) > 0
      and (select count(*) from public.party_members m where m.party_id = p.id) < p.capacity
    order by p.created_at desc
    limit 50
  ) x;
$$;

create or replace function public.get_party(p_id text) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  pid text := upper(trim(p_id));
  room public.parties%rowtype;
begin
  select * into room from public.parties where id = pid;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', room.id,
    'game_slug', room.game_slug,
    'capacity', room.capacity,
    'entry', room.entry,
    'entry_lamports', room.entry_lamports,
    'host_id', room.host_id,
    'status', room.status,
    'visibility', room.visibility,
    'escrow_pda', room.escrow_pda,
    'escrow_deposits', coalesce(room.escrow_deposits, '[]'::jsonb),
    'game_path', room.game_path,
    'created_at', (extract(epoch from room.created_at) * 1000)::bigint,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.user_id, 'username', m.username, 'avatar', m.avatar, 'color', m.color,
        'isHost', m.is_host, 'joinedAt', (extract(epoch from m.joined_at) * 1000)::bigint
      ) order by m.joined_at)
      from public.party_members m where m.party_id = pid
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public._clashr_ensure_player(text, text, text, text) from public, anon, authenticated;
grant execute on function public.publish_party(text, text, integer, integer, bigint, text, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.join_party(text, text, text, text, text) to anon, authenticated;
grant execute on function public.leave_party(text, text) to anon, authenticated;
grant execute on function public.touch_party(text, text) to anon, authenticated;
grant execute on function public.start_party(text, text, text) to anon, authenticated;
grant execute on function public.list_public_parties() to anon, authenticated;
grant execute on function public.get_party(text) to anon, authenticated;

drop policy if exists parties_public_read on public.parties;
create policy parties_public_read on public.parties
  for select to anon, authenticated
  using (visibility = 'public' and status = 'waiting');

drop policy if exists party_members_public_read on public.party_members;
create policy party_members_public_read on public.party_members
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.parties p
      where p.id = party_id and p.visibility = 'public' and p.status = 'waiting'
    )
  );

grant select on table public.parties to anon, authenticated;
grant select on table public.party_members to anon, authenticated;
