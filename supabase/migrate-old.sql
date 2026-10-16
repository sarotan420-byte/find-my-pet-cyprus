-- =====================================================================
-- One-time copy of listings and saved searches from the previous build
-- (tables: pets, saved_searches) into the new tables.
-- Run AFTER setup.sql and BEFORE the site is connected to the database.
-- Safe to run more than once (already-copied rows are skipped).
-- Old tables are left untouched.
-- =====================================================================

-- Imported listings may have been posted without an account.
alter table public.listings alter column owner_id drop not null;

insert into public.listings (
  id, created_at, owner_id, moderation_status, reject_reason, closed,
  status, species, name, breed, size, sex, colours, color,
  district, postcode, area, lat, lng, event_date, description, photos)
select
  p.id, p.created_at,
  (select u.id from auth.users u where u.id = p.reporter_id),
  p.moderation_status, p.reject_reason, p.status = 'reunited',
  case when p.status = 'reunited' then 'missing' else p.status end,
  p.species,
  nullif(left(nullif(trim(p.name), 'Unnamed'), 60), ''),
  nullif(left(trim(p.breed), 80), ''),
  null, 'Unknown', '{}',
  nullif(left(trim(p.color), 80), ''),
  d.district,
  case when p.postcode ~ '^\d{4}$' then p.postcode end,
  left(coalesce(nullif(trim(regexp_replace(p.area, '^\s*(Nicosia|Lefkosia|Limassol|Lemesos|Larnaca|Paphos|Pafos|Famagusta|Kyrenia)\s*[—–,-]\s*', '', 'i')), ''), p.area), 120),
  p.lat, p.lng, p.date_seen,
  case when char_length(trim(p.description)) >= 10 then left(p.description, 2000)
       else coalesce(nullif(trim(p.description), '') || ' ', '') || '(No description given.)' end,
  (coalesce(nullif(p.photos, '{}'), case when p.photo_url is not null then array[p.photo_url] end, '{}'))[1:3]
from public.pets p
cross join lateral (
  select case
    when p.area ~* '(nicosia|lefkosia|strovolos|lakatamia|engomi|aglantzia|latsia|dali|tseri)' then 'Nicosia'
    when p.area ~* '(limassol|lemesos|germasogeia|ypsonas|polemidia|mesa geitonia|agios athanasios)' then 'Limassol'
    when p.area ~* '(larnaca|larnaka|aradippou|livadia|oroklini|dromolaxia|kiti)' then 'Larnaca'
    when p.area ~* '(paphos|pafos|peyia|pegeia|chloraka|tala|polis|geroskipou)' then 'Paphos'
    when p.area ~* '(famagusta|ammochostos|paralimni|ayia napa|agia napa|protaras|deryneia|sotira)' then 'Famagusta'
    when p.area ~* '(kyrenia|girne)' then 'Kyrenia'
    when p.postcode ~ '^[12]\d{3}$' then 'Nicosia'
    when p.postcode ~ '^[34]\d{3}$' then 'Limassol'
    when p.postcode ~ '^5\d{3}$' then 'Famagusta'
    when p.postcode ~ '^[67]\d{3}$' then 'Larnaca'
    when p.postcode ~ '^8\d{3}$' then 'Paphos'
    else (select v.d from (values ('Nicosia',35.17,33.36),('Limassol',34.68,33.04),('Larnaca',34.92,33.62),
                                  ('Paphos',34.78,32.42),('Famagusta',35.04,33.98),('Kyrenia',35.34,33.32)) v(d, la, ln)
          order by (v.la - p.lat)^2 + (v.ln - p.lng)^2 limit 1)
  end as district
) d
where p.lat between 34.4 and 35.8 and p.lng between 32.2 and 34.7
  and not exists (select 1 from public.listings l where l.id = p.id);

insert into public.listing_contacts (listing_id, name, phone, email)
select p.id,
  left(coalesce(nullif(trim(p.contact_name), ''), 'Owner'), 80),
  left(coalesce(case when char_length(trim(p.contact_phone)) >= 6 then trim(p.contact_phone) end, 'Not given'), 30),
  nullif(left(trim(p.contact_email), 200), '')
from public.pets p
join public.listings l on l.id = p.id
where not exists (select 1 from public.listing_contacts c where c.listing_id = p.id);

-- New listings continue numbering after the imported ones.
select setval(pg_get_serial_sequence('public.listings', 'id'), greatest((select max(id) from public.listings), 1));

insert into public.saved_views (created_at, user_id, label, url)
select s.created_at, s.user_id, left(s.label, 200),
  (case when s.filters->>'status' = 'found' then 'found.html' else 'missing.html' end) ||
  coalesce('?' || nullif(concat_ws('&',
     case when coalesce(s.filters->>'species','') <> '' then 'species=' || (s.filters->>'species') end,
     case when initcap(s.filters->>'area') in ('Nicosia','Limassol','Larnaca','Paphos','Famagusta','Kyrenia') then 'district=' || initcap(s.filters->>'area')
          when coalesce(s.filters->>'area','') <> '' then 'q=' || replace(s.filters->>'area', ' ', '+') end,
     case when coalesce(s.filters->>'query','') <> '' then 'q=' || replace(s.filters->>'query', ' ', '+') end), ''), '')
from public.saved_searches s
join auth.users u on u.id = s.user_id
where not exists (select 1 from public.saved_views v where v.user_id = s.user_id and v.label = left(s.label, 200));

-- Summary
select (select count(*) from public.pets) as old_listings,
       (select count(*) from public.listings) as new_listings,
       (select count(*) from public.saved_searches) as old_saved_searches,
       (select count(*) from public.saved_views) as new_saved_searches;
