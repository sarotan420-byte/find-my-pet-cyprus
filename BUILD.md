# Build guide: Find My Pet Cyprus

How to turn the HTML prototypes in this folder into a production site. Read `README.md` first for the screen-by-screen design spec. This file covers architecture, data, APIs, routes, SEO, hosting, and the order to build things in.

> **Prompt to paste into Claude Code:**
> "Read README.md and BUILD.md in design_handoff_find_my_pet_cyprus. Scaffold the project described in BUILD.md (Astro + Supabase). Then build Phase 1, matching the HTML prototypes visually. Use the Organic tokens from styles.css as CSS variables."

---

## 1. Recommended stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Astro** (SSR + static output, islands) | Ships almost zero JS by default, great for SEO and mobile performance. Interactive parts (map, filters, form) become small islands. Next.js is a fine alternative if you prefer React throughout. |
| Interactive islands | Preact or vanilla TS | Small bundles. The prototype logic in `browse.js` and the inline scripts ports almost directly. |
| Database + auth | **Supabase** (Postgres + PostGIS + Auth + Storage) | Radius search via PostGIS, row-level security for moderation, magic-link email login, and a generous free tier. |
| Photo storage | Supabase Storage or Cloudflare R2 | R2 has no egress fees, which matters when a listing goes viral. |
| Image resizing | Upload-time resize to WebP/AVIF (Supabase image transforms, or Cloudflare Images) | Phones on 4G load 400px thumbnails, not 4MB originals. |
| Hosting | **Cloudflare Pages** (or Netlify/Vercel) | Free/cheap, global CDN, and absorbs traffic spikes because pages are cached at the edge. |
| Map | Leaflet + **MapTiler** or **Stadia** tiles (or self-hosted **Protomaps** on R2) | The prototype's free OSM/CARTO tiles aren't allowed for production traffic. |
| Geocoding | MapTiler / Stadia geocoder (same key), restricted to `countrycodes=cy` | Powers the city/area/postcode search box. |
| Email | Resend or Postmark | Magic links, moderation decisions, and later the alerts. |
| Spam protection | Cloudflare Turnstile on the submit form | Invisible CAPTCHA, free. |
| Analytics | Plausible or Cloudflare Web Analytics | Cookie-free, so no consent banner needed. |

Rough running cost at launch: **€0–25/month** (domain + map tiles beyond the free tier).

---

## 2. Project structure

```
/src
  /pages
    index.astro                 → homepage + map
    missing/index.astro         → list (missing)
    missing/[district].astro    → SEO district pages, e.g. /missing/limassol
    found/index.astro
    found/[district].astro
    adopt/index.astro
    adopt/[district].astro
    pet/[id]-[slug].astro       → listing detail
    report.astro                → 5-step form
    account/index.astro
    account/login.astro
    moderation/index.astro      → moderator-only
    sitemap.xml.ts
    api/…                       → see §5
  /components
    Nav.astro  Footer.astro  PetRow.astro  PetCard.astro  Tag.astro
    FilterSidebar.astro  ColourSwatches.astro  StatusTabs.astro
  /islands
    MapSearch.tsx    ListFilters.tsx    ReportForm.tsx
    ContactReveal.tsx    ModerationQueue.tsx    MiniMap.tsx
  /lib
    supabase.ts  geo.ts  filters.ts  constants.ts  seo.ts  checks.ts
  /styles
    organic.css      → copy of _ds/.../styles.css (tokens + .btn/.tag/.input etc.)
    site.css         → page styles lifted from the prototypes' <style> blocks
/supabase
  migrations/0001_init.sql
  seed.sql
```

`constants.ts` should hold the lists that live in `data.js` today: `COLOURS`, `AREAS` (districts), `EXOTIC_TYPES`, `AGES`, plus `LISTER_TYPES` and `REJECT_REASONS`.

---

## 3. Database schema (Postgres / Supabase)

```sql
create extension if not exists postgis;

create type listing_status as enum ('missing','found','adoption');
create type species       as enum ('Dog','Cat','Other');
create type mod_status    as enum ('pending','changes','approved','rejected','resolved');
create type size_band     as enum ('Small','Medium','Large');
create type sex           as enum ('Male','Female','Unknown');
create type age_band      as enum ('Puppy / kitten','Young','Adult','Senior');
create type lister_type   as enum ('Owner rehoming','Foster home','Rescue group','Shelter');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  phone text,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  created_at timestamptz default now()
);

create table listings (
  id bigint generated always as identity primary key,
  slug text not null,                       -- e.g. 'black-labrador-engomi'
  owner_id uuid references profiles(id),
  status listing_status not null,
  species species not null,
  exotic_type text,                         -- only when species = 'Other'
  name text,
  breed text,
  colours text[] not null default '{}',     -- cats/dogs only; values from COLOURS
  colour_text text,                         -- free text (exotics) / markings
  size size_band,
  sex sex default 'Unknown',
  collar boolean default false,
  chipped boolean default false,
  -- adoption-only
  age_band age_band,
  age_text text,
  neutered boolean,
  vaccinated boolean,
  good_with text[] default '{}',            -- 'Children','Dogs','Cats'
  lister lister_type,
  fee_eur int,
  -- location
  district text not null,
  postcode char(4),
  area_text text not null,
  geom geography(Point, 4326) not null,
  -- time
  event_date date not null,                 -- last seen / found / available from
  event_time time,
  description text not null,
  -- contact (never rendered into HTML; served via /api/contact)
  contact_name text not null,
  contact_phone text not null,
  contact_email text,
  -- moderation
  mod_status mod_status not null default 'pending',
  mod_note text,
  reject_reason text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  auto_flags text[] default '{}',           -- results of lib/checks.ts
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on listings using gist (geom);
create index on listings (status, mod_status, event_date desc);
create index on listings using gin (colours);
create index on listings (district);

create table listing_photos (
  id bigint generated always as identity primary key,
  listing_id bigint references listings on delete cascade,
  path text not null,
  position smallint not null default 0,
  width int, height int
);

create table saved_searches (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade,
  label text not null,                      -- 'Missing dogs · Limassol · 15 km'
  query jsonb not null,                     -- same shape as list-page URL params
  center geography(Point, 4326),
  radius_km int,
  created_at timestamptz default now(),
  last_notified_at timestamptz              -- for the post-launch alerts
);

create table moderation_log (
  id bigint generated always as identity primary key,
  listing_id bigint references listings on delete cascade,
  moderator_id uuid references profiles(id),
  action mod_status not null,
  note text,
  created_at timestamptz default now()
);

create table contact_reveals (               -- rate limiting + abuse audit
  listing_id bigint references listings,
  ip_hash text,
  created_at timestamptz default now()
);
```

### Row-level security
- `listings`: **public select only where `mod_status = 'approved'`**, and never the contact columns. Expose a `public_listings` view without `contact_*`, and grant anon access to that view only.
- Owners can select and update their own rows. Any owner edit to an approved listing sets `mod_status` back to `'pending'`.
- Moderators (role in `moderator`/`admin`) can select and update all rows, and insert into `moderation_log`.
- `saved_searches`: owner only.

### Radius search function
```sql
create or replace function search_listings(
  p_status listing_status, p_lat float default null, p_lng float default null,
  p_radius_km int default null, p_species species default null,
  p_colours text[] default null, p_sizes size_band[] default null,
  p_sex sex default null, p_district text default null, p_since_days int default null,
  p_collar boolean default null, p_chipped boolean default null, p_q text default null,
  p_limit int default 30, p_offset int default 0
) returns setof public_listings language sql stable as $$
  select * from public_listings l
  where l.status = p_status
    and (p_species is null or l.species = p_species)
    and (p_colours is null or l.colours @> p_colours)        -- AND match: must have every colour
    and (p_sizes is null or l.size = any(p_sizes))
    and (p_sex is null or l.sex = p_sex)
    and (p_district is null or l.district = p_district)
    and (p_since_days is null or l.event_date >= current_date - p_since_days)
    and (p_collar is not true or l.collar)
    and (p_chipped is not true or l.chipped)
    and (p_q is null or l.search_tsv @@ websearch_to_tsquery('simple', p_q))
    and (p_lat is null or st_dwithin(l.geom, st_makepoint(p_lng, p_lat)::geography, p_radius_km * 1000))
  order by l.event_date desc
  limit p_limit offset p_offset;
$$;
```
Add a generated `search_tsv` column over name, breed, colour text, area text and description. Write an equivalent `search_adoptions()` for the adoption filters (age band, good with as `@>`, neutered, vaccinated, lister).

---

## 4. Routes and rendering

| URL | Render | Cache | Notes |
|---|---|---|---|
| `/` | SSR | CDN 60s, stale-while-revalidate 1 day | Map island loads after first paint. Seed pins from `/api/pins`. |
| `/missing`, `/found`, `/adopt` | SSR | 60s + SWR | First page of results is server-rendered (crawlable). Filters are applied client-side via the API and synced to the URL. |
| `/missing/limassol` etc. | SSR | 5 min + SWR | One per district × type = 18 SEO landing pages. Unique H1 and intro. |
| `/pet/123-black-labrador-engomi` | SSR | 5 min + SWR, purged on edit | The page that goes viral. **Must be fully cacheable**, which is why contact details load via an API call. |
| `/report` | Static shell + island | 1 day | Works without an account. Asks for email at step 5 to create one silently (magic link). |
| `/account`, `/moderation` | SSR, auth-gated | no-store | `noindex`. |
| `/sitemap.xml` | SSR | 1 h | All approved listings, plus list and district pages. |

Old listings: mark them `resolved` ("Reunited") rather than deleting. Keep the page live for 90 days with a banner, then return 410.

---

## 5. API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/listings?status=&species=&colour=a,b&size=&sex=&district=&since=&collar=&chipped=&q=&lat=&lng=&radius=&page=` | public | Wraps `search_listings`. Response cached 30s. |
| GET | `/api/pins?status=` | public | Lightweight `[id,lat,lng,status]` for the map, cached 60s. |
| GET | `/api/geocode?q=` | public | Proxies MapTiler/Stadia so the key stays server-side. Handles 4-digit postcodes and Cyprus place names. Cached 1 day. |
| GET | `/api/contact/:id` | public + Turnstile | Returns name and phone for an approved listing. Rate limit: 10 per IP per hour. Logged in `contact_reveals`. |
| POST | `/api/listings` | optional (creates account by email) | Validates with zod, runs `lib/checks.ts`, stores `auto_flags`, sets `mod_status='pending'`. Turnstile required. |
| POST | `/api/photos` | same session as listing | Signed upload URL. Max 3 photos, 10 MB each. Strip EXIF GPS. Resize to 1600 / 800 / 400. |
| PATCH | `/api/listings/:id` | owner | Edit (re-queues for moderation), or mark "Reunited". |
| GET/POST/DELETE | `/api/saved-searches` | user | Save from any list page using its current URL params. |
| GET | `/api/moderation?state=` | moderator | Queue, oldest first. |
| POST | `/api/moderation/:id` | moderator | `{action: approved|changes|rejected, note, reason}`. Writes `moderation_log`, emails the poster, purges the CDN cache for that URL. |

### Automatic checks (`lib/checks.ts`), run on submit and shown in the queue
- No photos
- Possible duplicate: same species, overlapping colours, within 2 km, within 7 days, opposite or same status
- Sale wording (`price|€|euro|papers|pedigree|negotiable|whatsapp|for sale`), or an adoption fee over €150
- Phone number or email inside the description
- New account (< 24 h) or more than 3 listings in 30 days
- Postcode doesn't match the district (the first digit maps to a district, see the homepage gazetteer)
- Missing/found date in the future

---

## 6. SEO checklist
- [ ] Unique `<title>` and meta description per listing: "Missing black Labrador in Engomi, Nicosia — Find My Pet Cyprus".
- [ ] Open Graph and Twitter cards with the main photo (1200×630 crop generated at upload). This is critical for Facebook shares.
- [ ] JSON-LD: listing pages use `schema.org/Thing` + `Place`. Adoption pages can use `Offer` only when there's no fee. Use `BreadcrumbList` everywhere.
- [ ] Canonical URLs. Filtered list views (`?colour=`) get `<link rel="canonical">` to the unfiltered page, with district pages as the indexable variants.
- [ ] `robots.txt` blocks `/account`, `/moderation` and `/api`.
- [ ] Server-rendered first page of every list. No content hidden behind JS.
- [ ] `hreflang` ready for a later Greek version (`/el/…`).
- [ ] Core Web Vitals targets: LCP < 2.0s on 4G, CLS < 0.05, JS < 60 KB on list and detail pages.

## 7. Performance and traffic spikes
- Detail pages are fully CDN-cached HTML, and the only dynamic call is the contact reveal. Even 100k Facebook clicks cost almost nothing.
- Load images with `srcset`. Mark the main photo `fetchpriority="high"` and lazy-load the rest.
- Load Leaflet and the map tiles only when the map scrolls into view (`IntersectionObserver`). The list pages don't load the map at all.
- Self-host the fonts (Caprasimo, Figtree) with `font-display: swap` and subset to Latin + Greek.
- Use DB connection pooling (Supabase pooler), and keep every public read behind the CDN.

## 8. Security and privacy
- Contact details never appear in HTML, in sitemaps, or in the `public_listings` view.
- Strip EXIF from uploads (owners' home GPS coordinates).
- Use Turnstile on submit and on contact reveal, and rate limit by IP.
- Moderators need 2FA (Supabase Auth MFA).
- GDPR: add a privacy page, let users delete their account and listings, and keep contact reveal logs for 30 days only.

---

## 9. Build phases

**Phase 1: Foundations (week 1)**
1. Scaffold Astro, add `organic.css` + `site.css`, and build Nav, Footer, Tag and the Button styles.
2. Set up Supabase: run the migration and seed it from `data.js` (14 missing/found + 8 adoption listings).
3. Build `/pet/[id]-[slug]` (detail) with ContactReveal and MiniMap islands.

**Phase 2: Browse (week 2)**
4. Build `/missing`, `/found` and `/adopt`: port `browse.js` into a `ListFilters` island that calls `/api/listings`, with URL sync and the mobile filter sheet.
5. Build the district SEO pages and the sitemap.

**Phase 3: Map + search (week 3)**
6. Build the homepage map island: geocoder proxy, suggestions, radius circle, results panel, quick chips.

**Phase 4: Reporting (week 4)**
7. Build `/report` as a `ReportForm` island (5 steps, missing/found/adoption branches, localStorage draft, photo upload, Turnstile).
8. Set up auth: magic-link login and the account page (my listings with status pills, saved searches, "Mark as reunited").

**Phase 5: Moderation + launch (week 5)**
9. Build `/moderation`: queue, checks, actions, undo, J/K/A shortcuts, audit log, email templates (approved / changes requested / rejected).
10. Launch: privacy page, analytics, error tracking (Sentry), Lighthouse ≥ 95 on mobile, load test a detail page.

**Post-launch fast follow: alerts**
- A Supabase cron job every 15 minutes: for each newly approved listing, find `saved_searches` whose query matches and whose centre is within the radius, then email via Resend. Update `last_notified_at` and include a one-click unsubscribe.

---

## 10. Porting notes from the prototypes
- **Inline styles → CSS.** The prototypes use page-level `<style>` blocks. Lift them into `site.css`, grouped per page, and keep the class names. They already reference Organic tokens.
- **Page background is `#fff`**, not the system's cream. Keep `--white` as an override token.
- **Colour filter rules:** cats and dogs only, multi-select, AND match (`colours @> selected`). The group is hidden when the animal is Other / exotic.
- **Unnamed found pets** get a generated title: `{colour_text} {species}` (e.g. "Grey tabby cat").
- **`search.html`** is superseded by the homepage map plus the list pages. Don't build it.
- **`image-slot.js`** is a prototype-only placeholder. Replace it with a real file input, previews, drag-to-reorder and a progress indicator.
- **The demo gazetteer** (place list and postcode-prefix map in `index.html`) is a temporary stand-in for the geocoder. Keep the postcode-prefix → district map in `lib/geo.ts` for the moderation check.
