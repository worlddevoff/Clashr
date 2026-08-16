-- Keep an append-only audit row for every successful signed wallet login.
-- The first login is a signup; later logins are connections.
create table if not exists public.wallet_connection_events (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  event_type text not null,
  session_id uuid not null unique,
  created_at timestamp(3) not null default current_timestamp,
  constraint wallet_connection_events_event_type_check
    check (event_type in ('signup', 'connection')),
  constraint wallet_connection_events_wallet_address_fkey
    foreign key (wallet_address) references public.players(id)
    on delete cascade on update cascade,
  constraint wallet_connection_events_session_id_fkey
    foreign key (session_id) references public.sessions(id)
    on delete cascade on update cascade
);

create index if not exists wallet_connection_events_wallet_address_created_at_idx
  on public.wallet_connection_events(wallet_address, created_at);
create index if not exists wallet_connection_events_event_type_created_at_idx
  on public.wallet_connection_events(event_type, created_at);

alter table public.wallet_connection_events enable row level security;

revoke all on table public.wallet_connection_events from anon, authenticated, public;

drop policy if exists clashr_no_direct_access on public.wallet_connection_events;
create policy clashr_no_direct_access
  on public.wallet_connection_events
  for all
  to anon, authenticated
  using (false)
  with check (false);
