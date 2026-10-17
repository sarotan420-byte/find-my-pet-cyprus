-- =====================================================================
-- GDPR: "delete my account" and automatic clean-up of old data.
-- Run once in Supabase → SQL Editor. Safe to run more than once.
-- =====================================================================

-- A signed-in person deletes their own account. Their listings, contact
-- details and saved searches are removed with it (cascade). The website
-- deletes their photos from storage first.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if to_regclass('public.service_suggestions') is not null then
    execute 'delete from public.service_suggestions where user_id = $1' using auth.uid();
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Retention rules (see the privacy policy):
--  * closed or rejected listings are deleted 12 months after they were closed / reviewed
--  * guest (anonymous) accounts with no listings are deleted after 30 days
-- Returns how many rows were removed. Called daily by the website's GitHub job.
alter table public.listings add column if not exists closed_at timestamptz;

create or replace function public.mark_closed_at() returns trigger language plpgsql as $$
begin
  if new.closed and not coalesce(old.closed, false) then new.closed_at := now(); end if;
  return new;
end $$;
drop trigger if exists listings_closed_at on public.listings;
create trigger listings_closed_at before update of closed on public.listings
  for each row execute function public.mark_closed_at();

create or replace function public.cleanup_old_data()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare n_listings int; n_guests int;
begin
  delete from public.listings
  where (closed and coalesce(closed_at, reviewed_at, created_at) < now() - interval '12 months')
     or (moderation_status = 'rejected' and coalesce(reviewed_at, created_at) < now() - interval '12 months');
  get diagnostics n_listings = row_count;

  delete from auth.users u
  where coalesce(u.is_anonymous, false)
    and u.created_at < now() - interval '30 days'
    and not exists (select 1 from public.listings l where l.owner_id = u.id);
  get diagnostics n_guests = row_count;

  return jsonb_build_object('listings_deleted', n_listings, 'guest_accounts_deleted', n_guests);
end $$;
revoke execute on function public.cleanup_old_data() from public, anon, authenticated;

-- Photos of listings that no longer exist (used by the clean-up job to delete the files).
create or replace function public.orphan_photo_paths()
returns setof text language sql stable security definer set search_path = public, storage as $$
  select o.name from storage.objects o
  where o.bucket_id = 'listing-photos'
    and o.created_at < now() - interval '2 days'
    and not exists (
      select 1 from public.listings l
      where '/storage/v1/object/public/listing-photos/' || o.name = any (
        select substring(p from '/storage/v1/object/public/listing-photos/.*') from unnest(l.photos) p))
  limit 1000;
$$;
revoke execute on function public.orphan_photo_paths() from public, anon, authenticated;
