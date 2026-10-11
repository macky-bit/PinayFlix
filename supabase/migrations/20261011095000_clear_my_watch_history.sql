create or replace function public.clear_my_watch_history()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.watch_history as history
  using public."user" as account
  where history.user_id = account.user_id
    and account.auth_user_id = auth.uid();
end;
$$;

revoke all on function public.clear_my_watch_history() from public;
grant execute on function public.clear_my_watch_history() to authenticated;
