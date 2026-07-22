# Find My Pet Cyprus 

The real, buildable website — your prototype's design ported onto **Astro** (fast, SEO-strong, cheap to host), ready to connect to a database.

## Status

| Milestone | What it adds | State |
|---|---|---|
| **M1** | Astro scaffold + your design + all 5 pages | ✅ Done |
| **M2** | Supabase database schema + data layer | ✅ Done |
| **M3** | Working report form + photo upload | ✅ Done |
| **M4** | Live map + postcode/area/radius search | ✅ Done |
| **M5** | Accounts + saved searches | ✅ Done |
| **M6** | Moderation admin + anti-spam | ✅ Done |
| **M7** | SEO, social sharing, performance | ✅ Done |
| **M8** | Deploy to Cloudflare + domain | ✅ Configured — follow `DEPLOY.md` |

**To go live:** open `DEPLOY.md` and follow it step by step. The build is set up
for Cloudflare Pages + Supabase at **www.findmypetcy.com**.

## What works right now

All five pages are built and render your exact design: home, search map, report form (4 steps), listing detail, account. They currently run on **built-in demo data** (6 sample pets) — no accounts or setup needed to see it. Listing pages are pre-generated per pet, which is ideal for SEO. Every page has proper titles, descriptions, canonical URLs, and social-share cards.

The **report form is now live**: it compresses photos in the browser, then posts to a real `/api/report` endpoint that validates everything, blocks spam (honeypot + Cloudflare Turnstile), uploads photos to storage, and saves the listing as *pending* for moderation. Until Supabase keys are added it runs in a safe "demo" mode (accepts and validates the submission without persisting), so the whole flow is testable now. Tested end-to-end: valid submissions succeed; missing fields and spam are rejected with clear messages.

## Preview it on your computer (optional)

In a terminal:

```
cd "Find my pet Cypprus/app"
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:4321).

## How it's organised

- `src/pages/` — the five pages
- `src/components/` — shared bits (nav, footer, pet card)
- `src/lib/` — the data layer; `pets.ts` is the single place that swaps demo data for the live database in M2
- `public/` — your design system stylesheet, fonts, images
- `_prototype/` (one level up) — your original prototype, kept for reference

Nothing here is locked in to any paid service.
