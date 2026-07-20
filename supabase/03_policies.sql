-- ============================================================================
-- Find My Pet Cyprus — 03 row-level security & grants
-- ============================================================================

alter table public.profiles      enable row level security;
alter table public.pets          enable row level security;
alter table public.saved_searches enable row level security;
alter table public.reports       enable row level security;

-- Base privileges (RLS still gates individual rows).
grant usage on schema public to anon, authenticated;
grant select, insert          on public.pets           to anon, authenticated;
grant update, delete          on public.pets           to authenticated;
grant select, insert, update, delete on public.saved_searches to authenticated;
grant select                  on public.profiles       to authenticated;
grant update                  on public.profiles       to authenticated;
grant insert                  on public.reports        to anon, authenticated;
grant select, update          on public.reports        to authenticated;
grant execute on function public.search_pets(text,text,text,text,double precision,double precision,double precision) to anon, authenticated;

-- ── profiles ────────────────────────────────────────────────────────────────
drop policy if exists "profiles self read"   on public.profiles;
create policy "profiles self read"   on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── pets ────────────────────────────────────────────────────────────────────
-- Public sees approved listings; owners see their own; admins see everything.
drop policy if exists "pets read" on public.pets;
create policy "pets read" on public.pets
  for select using (
    moderation_status = 'approved'
    or reporter_id = auth.uid()
    or public.is_admin()
  );

-- Anyone (even without an account) can submit. The guard forces status=pending.
drop policy if exists "pets insert" on public.pets;
create policy "pets insert" on public.pets
  for insert with check (reporter_id is null or reporter_id = auth.uid());

-- Owners can edit their own listing (e.g. mark reunited); admins edit any.
drop policy if exists "pets update" on public.pets;
create policy "pets update" on public.pets
  for update using (reporter_id = auth.uid() or public.is_admin())
  with check (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "pets delete" on public.pets;
create policy "pets delete" on public.pets
  for delete using (reporter_id = auth.uid() or public.is_admin());

-- ── saved searches ──────────────────────────────────────────────────────────
drop policy if exists "saved own" on public.saved_searches;
create policy "saved own" on public.saved_searches
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── reports ─────────────────────────────────────────────────────────────────
drop policy if exists "reports insert" on public.reports;
create policy "reports insert" on public.reports
  for insert with check (true);

drop policy if exists "reports admin read" on public.reports;
create policy "reports admin read" on public.reports
  for select using (public.is_admin());

drop policy if exists "reports admin update" on public.reports;
create policy "reports admin update" on public.reports
  for update using (public.is_admin());
