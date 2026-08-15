-- Browser roles must not read or mutate Clashr tables. The Node API uses DATABASE_URL.

revoke execute on function public.get_party(text) from anon, authenticated, public;
revoke execute on function public.list_public_parties() from anon, authenticated, public;
revoke execute on function public.publish_party(text, text, integer, integer, bigint, text, text, text, text, text, text, jsonb) from anon, authenticated, public;
revoke execute on function public.join_party(text, text, text, text, text) from anon, authenticated, public;
revoke execute on function public.leave_party(text, text) from anon, authenticated, public;
revoke execute on function public.touch_party(text, text) from anon, authenticated, public;
revoke execute on function public.start_party(text, text, text) from anon, authenticated, public;
revoke execute on function public._clashr_ensure_player(text, text, text, text) from anon, authenticated, public;

drop policy if exists parties_public_read on public.parties;
drop policy if exists party_members_public_read on public.party_members;

revoke all on all tables in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated, public;

alter default privileges in schema public revoke all on tables from anon, authenticated, public;
alter default privileges in schema public revoke all on sequences from anon, authenticated, public;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

grant usage on schema public to anon, authenticated;
