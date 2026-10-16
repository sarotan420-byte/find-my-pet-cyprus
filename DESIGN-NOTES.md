# Handoff: Find My Pet Cyprus

## Overview
A website for reporting and finding missing, found and adoptable pets across Cyprus. Core features:
- Homepage with a large interactive map, searchable by city, area or postcode, with a radius filter.
- Separate list views for **Missing**, **Found** and **For adoption**, filterable by characteristics (animal, coat colour, size, sex, district, date, ID).
- Multi-step **report form** (missing or found) with photos, appearance, location and contact.
- **Listing detail** page with a mini map and click-to-reveal contact.
- **User accounts** with saved searches and "your listings" (with moderation status).
- **Moderation**: every listing is reviewed before it goes public, using the moderation queue (`moderation.html`).

Non-functional requirements from the brief: strong SEO, mobile-first performance, cheap hosting that survives traffic spikes (e.g. a listing going viral on Facebook).
Deferred to post-launch: automatic email alerts when a matching pet appears nearby.

## About the Design Files
The files in this bundle are **design references created in HTML**: prototypes that show the intended look and behaviour. They are not production code to copy directly. Recreate them in the target codebase's environment using its own patterns. If there is no codebase yet, pick a suitable framework. Recommended stack for this brief: a static-first / SSR framework such as Astro or Next.js with static generation, so listing pages are crawlable and served from a CDN. Pair it with a hosted database plus auth (e.g. Supabase) and object storage for photos.

All demo data lives in `data.js` and is placeholder content. In production it should come from an API that returns moderation-approved listings only.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and interactions are final. The visual style is the "Organic" design system (`_ds/.../styles.css`): warm, rounded, Caprasimo headings over Figtree body text. One deliberate deviation is that **page backgrounds are pure white (#fff)**. The system's cream/sand/terracotta/sage colours are used only as secondary colours (surfaces, tags, accents).

## Screens / Views

### 1. Homepage (`index.html`)
- **Purpose:** Find a pet on the map fast, or start a report.
- **Layout:** Sticky white nav (bottom border neutral-200). Below it, an intro row: H1 "Missing and found pets across Cyprus" (Caprasimo, clamp 30–46px, line-height 1.1, max 20ch) with a one-line lede, and a secondary "Report missing or found" button on the right. Max content width 1320px; side padding clamp(16px, 4vw, 48px).
- **Map feature:** Full-width container, height min(78vh, 760px), min 520px, radius 2×radius-lg (56px), shadow-md. Leaflet map using CARTO Voyager tiles. Overlays:
  - **Search bar** (top-left, max 760px): white pill with shadow-lg containing a text input ("City, area or postcode — e.g. Limassol, Strovolos, 6023"), a status select (Missing & found / Missing only / Found only) and a primary "Search" button. Typing shows an autocomplete dropdown (white, radius-lg, shadow-lg) with place name plus kind (City / Town / Area · District / Postcode). Arrow keys and Enter work.
  - **Quick chips** under the search bar: Nicosia, Limassol, Larnaca, Paphos, Paralimni. White pill chips; the active chip is filled with the text colour.
  - **Results panel** (right, 340px wide): count in Caprasimo 17px plus a "where" line. When a place is chosen, a radius slider (2–40 km, default 10) appears. Below is a scrollable list (64px thumbnails, name, Missing/Found tag, species · area, distance · date) and an "Open full search" button.
  - **Legend** (bottom-left): Missing = accent #c67139 dot, Found = accent-2 #7a8a5e dot.
  - **Markers:** 18px circles with a 3px white border. Listings outside the filter fade to 25% opacity.
- **Below the map:** a 3-step "Report / Checked / Reunited" row (numbers in sage-100 circles) and a surface-coloured CTA patch: "Missing a pet right now?" with a primary "Report now" button. Footer links.
- **Mobile (≤820px):** the map becomes 58vh in a column, the search bar wraps, quick chips are hidden, and the panel sits below the map as a normal block.

### 2. Missing pets (`missing.html`) & Found pets (`found.html`)
Same template; `<body data-status>` switches the data. Logic is in `browse.js`.
- **Header:** H1 "Missing pets in Cyprus" / "Found pets in Cyprus" with a lede, plus a Missing/Found pill switch on the right.
- **Layout:** 2-column grid, 280px filter sidebar (sticky, top 80px) and fluid results. Gap is space-6.
- **Filters** (uppercase 12px/700 labels, letter-spacing .06em):
  - Keywords (search input with a Lucide search icon). Matches name, breed, colour text, area and description; every word must match.
  - Animal: Any / Dog / Cat / Other / exotic.
  - **Colour, for cats & dogs only, multi-select.** Swatch tiles in a 2-column grid. Colours: Black, White, Grey, Brown, Tan, Golden, Cream, Ginger, Brindle, Tabby, Tortoiseshell, Calico (pattern swatches use gradients). **Matching is AND**: the pet must have every selected colour. The group is hidden when Animal = Other / exotic, and exotic pets are excluded when any colour is selected.
  - Size (multi): Small / Medium / Large, as pill toggles. Checked = filled with text colour, white label.
  - Sex, District (Nicosia, Limassol, Larnaca, Paphos, Famagusta, Kyrenia), and Missing since / Found within (3 / 7 / 30 days).
  - Identification: Wearing a collar, Microchipped.
- **Results top bar:** count ("X of Y missing pets", Caprasimo 18px, aria-live), sort (Newest / Oldest / By area). Active filters show as removable accent-100 pills, plus "Clear all".
- **Result row:** a card with a 1px neutral-200 border, radius 1.25×radius-lg and padding space-3. On hover the border goes transparent and the card gets shadow-md. Grid is a 200px square photo plus a body. The body has: name in Caprasimo 22px (unnamed found pets show "Grey tabby cat" etc.), a date in 13px/600 (accent-700 for missing, accent-2-700 for found), trait chips (neutral-100 pills, with colour dots), a 2-line clamped description, and a footer with the area in bold and Microchipped (sage tag) / Collar (neutral tag).
- **URL sync:** filters are written to the query string (`?species=Dog&colour=Black,White&size=Large`) so filtered views can be shared and indexed.
- **Mobile (≤900px):** the sidebar becomes a full-screen overlay opened by a "Filters (n)" button, with a sticky "Show results" button. At ≤560px the photo column is 110px and the description is hidden.

### 3. For adoption (`adopt.html`)
- Same layout and styles as the Missing/Found pages.
- **Extra filters:** Age (multi: Puppy / kitten, Young, Adult, Senior); Good with (multi, AND: Children, Dogs, Cats); Health (Neutered / spayed, Vaccinated, Microchipped); Listed by (Shelter, Rescue group, Foster home, Owner rehoming). The colour behaviour is the same as above.
- **Sort:** Newest, Youngest first, Oldest first (by age band).
- **Row:** name, age band in sage-700, "Kind · age text · sex", traits, "Good with" sage-100 pills, a health row (check icon, or a dash at 50% opacity), area · lister, and a primary "Meet {name}" button.
- **Bottom CTA:** a surface patch reading "Need to rehome a pet, or run a rescue?" with a "List a pet" button that links to `submit.html?type=adoption`.

### 4. Report a pet (`submit.html`)
Max width 680px. Progress bar with 5 segments (done = sage, current = accent, upcoming = neutral-200).
The `?type=missing|found|adoption` URL parameter preselects the listing type.
1. **The basics:** Missing / Found / For adoption choice cards, then Dog / Cat / Other / exotic. Choosing Other reveals "Type of animal" (Bird, Rabbit, Tortoise / turtle, Reptile, Small mammal, Other).
2. **Appearance:** Coat colour swatches (multi, required, at least 1, error "Pick at least one colour.") for cats and dogs. For exotic pets this is replaced by a free-text colour field. Then optional Markings, Breed, Name (required if Missing), Size (radio pills, default Medium), Sex (Male / Female / Not sure) and Identification checkboxes ("Ringed, tagged or microchipped" for exotic pets).
3. **Where and when:** District (required), Postcode (optional, 4 digits), Area or street (required; the label changes to "where found" for Found), Date (required, max today), Time (optional).
4. **Photos and description:** 3 square photo slots (main + 2) and a Description textarea (required, min-height 140px, radius-lg).
5. **Contact and review:** Name, Phone (required), Email (optional, not public). A sage note explains that the phone number is only revealed on tap. A review table summarises every answer. An accuracy checkbox is required before "Submit for review".
- **Success state:** sage check circle, "Sent for review", and an explanation that a moderator checks listings, usually within a few hours. Buttons: "Go to my account" and "Browse listings".
- **For adoption** changes the form:
  - Title becomes "List a pet for adoption".
  - Step 2 adds Age band (required), Age in years or months, Good with (multi), and Health (Neutered, Vaccinated). The collar option is hidden.
  - Step 3 labels change to "Area where the pet is now" and "Available from". Future dates are allowed and the time field is hidden.
  - Step 5 adds "You are listing as" (required): Owner rehoming, Foster home, Rescue group or Shelter.
  - The review table and the "Browse listings" link (to `adopt.html`) adapt to match.
- Validation runs per step with native `reportValidity()`, and hidden fields are skipped.

### 5. Listing detail (`listing.html?id=`)
Two columns (fluid + 380px). Left: 4:3 photo (radius 56px), name in Caprasimo 34px with a status tag, a meta line, the description, 3 fact tiles (Breed / Colour / Status), and a 220px Leaflet mini map. Right: a sticky surface card with "Seen this pet?" / "Is this your pet?" / "Interested in {name}?", and a "Show contact details" button that reveals the contact (keeps contact info out of crawled HTML). The back link goes to the matching list page.

### 6. Account (`account.html`)
Sign-in gate (email). When signed in: saved searches (description, saved date, Open, Remove) and your listings with an In review (neutral) or Live (sage) pill. The note on the page says alerts are coming soon.

### 7. Moderation queue (`moderation.html`, noindex)
- **Header:** status tabs with counts: Pending, Changes requested, Approved, Rejected.
- **Left column (360px):** filter by type and sort (Oldest first / Most flags first). Queue cards show a thumbnail (or "No photo"), title, type tag, area, time since submission, and flag pills (red for blocking issues, terracotta for warnings).
- **Review pane:**
  - Header: title, ID, submitted time and the poster's listing count.
  - Content: three photo slots, the description with risky words highlighted ("price", "papers", "WhatsApp", phone numbers), and a details grid. Adoption listings also show Age, Listed by and Fee.
  - **Side column:** automatic checks (photos, possible duplicate with a link to the live match, sale language, phone number in the description, new account, high posting volume, postcode/district match, date validity). Below them: a note to the poster, a reject reason, and the actions **Approve and publish**, **Request changes** and **Reject**. Request changes and Reject require a note.
- **After an action:** the item moves tabs, the next item is selected, and a toast offers Undo. Keyboard shortcuts: J/K for next/previous, A to approve.
- **Production:** restrict to a moderator role, keep an audit log of who did what, email the poster on each decision, and put a rate limit on submissions.

### 8. Full search (`search.html`)
Older split list + map view (380px panel). It is kept as reference but superseded by the homepage map and the list pages. Consider merging it.

## Interactions & Behaviour
- Map: scroll-wheel zoom is enabled only after the first click (avoids page-scroll trapping). `flyToBounds` takes 0.8s. A radius circle is drawn in the accent colour at 7% fill.
- Hovering a list item opens its marker popup.
- Hover states come from the design system (accent ramp). Focus = `outline: 2px solid var(--color-accent); outline-offset: 2px`.
- Card hover: shadow-md, transition .15s.
- Empty states: dashed neutral-300 box with "No matches" and a CTA.
- Postcode search: a 4-digit Cyprus postcode resolves by its first digit to a district centre (demo only). Production should use a real geocoder.

## State Management
- List pages: `{ q, species, colours[], size[], sex, district, since, collar, chipped, sort }`. Adoption adds `ages[], good[], neutered, vaccinated, lister`. Derive from and write to URL params.
- Homepage map: `{ center, label, radius, status }`.
- Report form: current step plus all form fields. Persist a draft (localStorage) so a stressed owner doesn't lose progress.
- Listing data model (see `data.js`): `id, status (missing|found|adoption), species (Dog|Cat|Other), exoticType, name, breed, size, sex, colours[], color (free text), collar, chipped, area, district, lat, lng, date, desc, photo(s), contact`. Adoption adds `age, ageText, neutered, vaccinated, goodWith[], lister`. Add `moderationStatus (pending|approved|rejected)`, `ownerUserId` and `createdAt` server-side.

## Backend / Infra Notes
- **Moderation:** `moderationStatus` is one of pending, changes, approved or rejected. Only approved listings are published or indexed. Run the automatic checks server-side when a listing is submitted.
- **SEO:** server-render list and detail pages. Use a unique title/description per listing, `schema.org` structured data, canonical URLs (`/missing`, `/found`, `/adopt`, `/pet/{id}-{slug}`), crawlable district pages (`/missing/limassol`) and an XML sitemap.
- **Traffic spikes:** serve static/ISR pages from a CDN. Resize photos to WebP/AVIF at upload time. Use vector or self-hosted map tiles.
- **Map tiles:** the prototype uses free CARTO/OSM tiles, which aren't suitable for production traffic. Use MapTiler, Stadia Maps, or self-hosted Protomaps (cheapest at scale). Use a geocoder (MapTiler, Stadia or Nominatim) for place and postcode search.
- **Contact privacy:** fetch contact details only after the user taps "Show contact details". Add rate limiting and spam protection.

## Design Tokens
Colours:
- Page background: `#ffffff` (override)
- Design-system background (used for accents and the marker border): `#f5ead8`
- Surface: `#ebddc5`
- Text: `#201e1d`
- Divider: text at 16%
- Accent (terracotta) ramp, 100–900: `#fff2eb #ffe1d0 #ffc6a5 #f6a06b #d67f48 #b2622d #8c491a #643312 #402310` (base `#c67139`)
- Accent-2 (sage) ramp, 100–900: `#f0fae1 #e1eecc #ccdbb2 #aebf92 #8fa073 #728157 #56633f #3d472b #272e1b` (base `#7a8a5e`)
- Neutral ramp: see `styles.css`
- Missing = accent; Found / adoption = accent-2.

Type:
- Headings: Caprasimo 400 (H1 30–46px, card names 18–22px)
- Body: Figtree (14–15.5px, line-height 1.55–1.6)
- Labels: 12px/700, uppercase, letter-spacing .06em

Spacing: 4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2px (`--space-1..8`).

Radii:
- sm 8px, md 16px, lg 28px
- Buttons, inputs and chips: 999px (pill)
- Large containers: 2×lg

Shadows:
- sm: `0 1px 2px rgba(46,43,37,.14)`
- md: `0 3px 10px rgba(46,43,37,.16)`
- lg: `0 12px 32px rgba(46,43,37,.22)`

Icons: Lucide, stroke-width 2.75.

## Assets
- `assets/photo.jpg`: a placeholder photo used for every listing. Replace it with user uploads.
- Map: Leaflet 1.9.4 (unpkg CDN) with CARTO Voyager / OSM tiles.
- Fonts: Caprasimo and Figtree (Google Fonts, loaded by `styles.css`).

## Files
- `index.html`: homepage and map search
- `missing.html`, `found.html` + `browse.js`: list views and filter logic
- `adopt.html`: adoption list (inline logic)
- `submit.html`: 5-step report form
- `listing.html`: detail page
- `account.html`: account / saved searches (links to moderation)
- `moderation.html`: moderator review queue
- `search.html`: older full-screen map search (reference)
- `data.js`: demo data, colour list, districts, exotic types, age bands
- `_ds/.../styles.css`: Organic design-system tokens and component classes (`.btn`, `.tag`, `.input`, `.nav`…)
- `ds-base.js`: loads the stylesheet
- `image-slot.js`: prototype-only photo placeholder component

## Open items
- Post-launch: email alerts for saved searches.
