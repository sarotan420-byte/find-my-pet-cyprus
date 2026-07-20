-- ============================================================================
-- Find My Pet Cyprus — 02 functions & triggers
-- ============================================================================

-- ── Auto-create a profile for each new auth user ────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Admin check helper ──────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin);
$$;

-- ── Moderation guard ────────────────────────────────────────────────────────
-- Regardless of client, ordinary users can never approve their own listing or
-- tamper with moderation fields. Trusted contexts (direct SQL / service role /
-- admins) keep full control.
create or replace function public.pets_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;                       -- trusted: allow as-is
  end if;
  if tg_op = 'INSERT' then
    new.moderation_status := 'pending';
    new.reject_reason     := null;
  elsif tg_op = 'UPDATE' then
    new.moderation_status := old.moderation_status;
    new.reject_reason     := old.reject_reason;
    new.reporter_id       := old.reporter_id;
  end if;
  return new;
end; $$;

drop trigger if exists pets_guard_ins on public.pets;
create trigger pets_guard_ins before insert on public.pets
  for each row execute function public.pets_guard();

drop trigger if exists pets_guard_upd on public.pets;
create trigger pets_guard_upd before update on public.pets
  for each row execute function public.pets_guard();

-- ── Search RPC: attributes + optional point/radius ──────────────────────────
-- Returns only approved listings. Called from the search page (Milestone 4).
create or replace function public.search_pets(
  p_status    text default null,
  p_species   text default null,
  p_area      text default null,
  p_query     text default null,
  p_lat       double precision default null,
  p_lng       double precision default null,
  p_radius_km double precision default null
)
returns setof public.pets language sql stable as $$
  select *
  from public.pets p
  where p.moderation_status = 'approved'
    and (p_status  is null or p_status  = 'all' or p.status  = p_status)
    and (p_species is null or p_species = ''    or p.species = p_species)
    and (p_area    is null or p_area    = ''    or p.area ilike '%' || p_area || '%')
    and (
      p_query is null or p_query = ''
      or p.area     ilike '%' || p_query || '%'
      or p.name     ilike '%' || p_query || '%'
      or p.postcode ilike '%' || p_query || '%'
    )
    and (
      p_lat is null or p_lng is null or p_radius_km is null
      or st_dwithin(
           p.location,
           st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
           p_radius_km * 1000
         )
    )
  order by p.date_seen desc;
$$;
