-- ============================================================================
-- Find My Pet Cyprus — 01 schema
-- Run order: 01_schema → 02_functions → 03_policies → 04_seed
-- Paste each into the Supabase SQL editor (or use the Supabase CLI).
-- ============================================================================

-- PostGIS powers point + radius search ("within 15 km of here").
create extension if not exists postgis;

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per signed-in user, linked to Supabase Auth. is_admin gates the
-- moderation dashboard.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ── pets ────────────────────────────────────────────────────────────────────
-- Every listing. `location` is derived from lat/lng for fast geo queries.
create table if not exists public.pets (
  id                bigint generated always as identity primary key,
  status            text not null check (status in ('missing','found','reunited')),
  species           text not null check (species in ('Dog','Cat','Other')),
  name              text not null default 'Unnamed',
  breed             text default '',
  color             text default '',
  area              text not null,
  postcode          text,
  lat               double precision not null,
  lng               double precision not null,
  location          geography(Point, 4326)
                      generated always as
                      (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  date_seen         date not null,
  description       text not null default '',
  photos            text[] not null default '{}',
  photo_url         text,                -- first/primary photo, used on cards
  contact_name      text,
  contact_phone     text,
  contact_email     text,
  moderation_status text not null default 'pending'
                      check (moderation_status in ('pending','approved','rejected')),
  reject_reason     text,
  reporter_id       uuid references public.profiles(id) on delete set null,
  reunited_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists pets_moderation_date_idx on public.pets (moderation_status, date_seen desc);
create index if not exists pets_status_idx           on public.pets (status);
create index if not exists pets_species_idx          on public.pets (species);
create index if not exists pets_area_idx             on public.pets (area);
create index if not exists pets_location_idx         on public.pets using gist (location);

-- ── saved searches ──────────────────────────────────────────────────────────
-- A user's stored filter set. `filters` matches the PetFilter shape in the app.
-- This is also the groundwork for automatic alerts (post-launch).
create table if not exists public.saved_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  label      text not null,
  filters    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists saved_searches_user_idx on public.saved_searches (user_id);

-- ── reports (abuse flags) ───────────────────────────────────────────────────
-- Anyone can flag a listing; admins review in the moderation dashboard.
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  pet_id        bigint not null references public.pets(id) on delete cascade,
  reason        text not null,
  note          text,
  reporter_hash text,                    -- hashed IP for light rate-limiting
  resolved      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists reports_pet_idx        on public.reports (pet_id);
create index if not exists reports_unresolved_idx on public.reports (resolved) where resolved = false;
