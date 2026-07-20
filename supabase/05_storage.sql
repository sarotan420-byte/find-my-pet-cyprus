-- ============================================================================
-- Find My Pet Cyprus — 05 storage (photo bucket)
-- Run after 01–03. Creates a public bucket for pet photos.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', true)
on conflict (id) do nothing;

-- Anyone can view photos (needed to show them on listings/cards).
drop policy if exists "pet photos public read" on storage.objects;
create policy "pet photos public read" on storage.objects
  for select using (bucket_id = 'pet-photos');

-- Uploads normally go through the server (service role). This policy also
-- allows direct client uploads to the bucket if we ever need them.
drop policy if exists "pet photos insert" on storage.objects;
create policy "pet photos insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'pet-photos');
