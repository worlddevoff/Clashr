-- Party mutations move to the authenticated Node API. Keep public listing/get
-- for lobby discovery. Anon must not create, join, or start parties.

revoke execute on function public.publish_party(text, text, integer, integer, bigint, text, text, text, text, text, text, jsonb) from anon, authenticated, public;
revoke execute on function public.join_party(text, text, text, text, text) from anon, authenticated, public;
revoke execute on function public.leave_party(text, text) from anon, authenticated, public;
revoke execute on function public.touch_party(text, text) from anon, authenticated, public;
revoke execute on function public.start_party(text, text, text) from anon, authenticated, public;
