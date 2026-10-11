alter table public.watch_history
  add column if not exists member_profile_id bigint;

alter table public.watch_history
  add constraint watch_history_member_profile_id_fkey
  foreign key (member_profile_id)
  references public.member_profile(member_profile_id)
  on update cascade on delete cascade;

-- Existing account-level history is assigned to the account's first profile.
-- New records are always attributed to the active profile by the RPC below.
with preferred_profile as (
  select distinct on (profile.user_id)
    profile.user_id,
    profile.member_profile_id
  from public.member_profile as profile
  order by profile.user_id, profile.is_active desc, profile.display_order, profile.member_profile_id
)
update public.watch_history as history
set member_profile_id = preferred_profile.member_profile_id
from preferred_profile
where history.user_id = preferred_profile.user_id
  and history.member_profile_id is null;

create unique index if not exists watch_history_profile_content_unique
  on public.watch_history (member_profile_id, content_id)
  where member_profile_id is not null;

drop function if exists public.record_my_watch_progress(bigint, integer);
drop function if exists public.get_my_watch_history();
drop function if exists public.delete_my_watch_history_entry(bigint);
drop function if exists public.clear_my_watch_history();

create or replace function public.record_my_watch_progress(
  selected_content_id bigint,
  selected_last_playback integer,
  selected_profile_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_user_id public."user".user_id%type;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if selected_content_id is null or selected_last_playback is null
    or selected_last_playback < 0 or selected_profile_id is null then
    raise exception 'Invalid watch progress';
  end if;

  select account.user_id into viewer_user_id
  from public."user" as account
  where account.auth_user_id = auth.uid()
  limit 1;
  if viewer_user_id is null then
    raise exception 'StreamFlix user not found';
  end if;
  if not exists (
    select 1 from public.member_profile as profile
    where profile.member_profile_id = selected_profile_id
      and profile.user_id = viewer_user_id and profile.is_active
  ) then
    raise exception 'Profile not found';
  end if;
  if not exists (
    select 1 from public.content as catalog
    where catalog.content_id = selected_content_id
  ) then
    raise exception 'Content not found';
  end if;

  insert into public.watch_history (
    user_id, member_profile_id, content_id, watch_date, last_playback
  ) values (
    viewer_user_id, selected_profile_id, selected_content_id, now(), selected_last_playback
  )
  on conflict (member_profile_id, content_id) where member_profile_id is not null
  do update set
    user_id = excluded.user_id,
    watch_date = excluded.watch_date,
    last_playback = excluded.last_playback;
end;
$$;

create or replace function public.get_my_watch_history(selected_profile_id bigint)
returns table (
  content_id bigint,
  title text,
  thumbnail text,
  watch_date timestamp without time zone,
  last_playback integer,
  runtime integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select history.content_id, catalog.title::text, catalog.thumbnail,
    history.watch_date, history.last_playback, catalog.runtime
  from public.watch_history as history
  join public.content as catalog on catalog.content_id = history.content_id
  join public."user" as account on account.user_id = history.user_id
  join public.member_profile as profile
    on profile.member_profile_id = history.member_profile_id
   and profile.user_id = account.user_id
  where account.auth_user_id = auth.uid()
    and profile.member_profile_id = selected_profile_id
    and profile.is_active
  order by history.watch_date desc;
$$;

create or replace function public.delete_my_watch_history_entry(
  selected_content_id bigint,
  selected_profile_id bigint
)
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
  using public."user" as account, public.member_profile as profile
  where history.content_id = selected_content_id
    and history.member_profile_id = selected_profile_id
    and history.user_id = account.user_id
    and profile.member_profile_id = history.member_profile_id
    and profile.user_id = account.user_id
    and account.auth_user_id = auth.uid();
end;
$$;

create or replace function public.clear_my_watch_history(selected_profile_id bigint)
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
  using public."user" as account, public.member_profile as profile
  where history.user_id = account.user_id
    and history.member_profile_id = selected_profile_id
    and profile.member_profile_id = history.member_profile_id
    and profile.user_id = account.user_id
    and account.auth_user_id = auth.uid();
end;
$$;

revoke all on function public.record_my_watch_progress(bigint, integer, bigint) from public;
revoke all on function public.get_my_watch_history(bigint) from public;
revoke all on function public.delete_my_watch_history_entry(bigint, bigint) from public;
revoke all on function public.clear_my_watch_history(bigint) from public;
grant execute on function public.record_my_watch_progress(bigint, integer, bigint) to authenticated;
grant execute on function public.get_my_watch_history(bigint) to authenticated;
grant execute on function public.delete_my_watch_history_entry(bigint, bigint) to authenticated;
grant execute on function public.clear_my_watch_history(bigint) to authenticated;
