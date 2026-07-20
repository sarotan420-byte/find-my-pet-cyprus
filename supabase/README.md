# Database (Supabase)

The full schema for Find My Pet Cyprus. You don't need to run this yet — it's
here and validated, ready for the deploy milestone. When we set up your Supabase
project, we run these four files **in order** in the Supabase SQL editor:

1. `01_schema.sql` — tables (pets, profiles, saved_searches, reports) + PostGIS
2. `02_functions.sql` — auto-profile creation, admin check, moderation guard, the `search_pets` radius search
3. `03_policies.sql` — row-level security + grants (who can read/write what)
4. `04_seed.sql` — optional: the 6 demo listings, pre-approved
5. `05_storage.sql` — the public `pet-photos` bucket for uploaded photos

## What the design gives you

- **Public** can read only *approved* listings and submit new ones (which land as `pending`).
- **Reporters** can see and edit their own listing, including marking it reunited.
- **Admins** (a profile flagged `is_admin`) see everything and approve/reject.
- A database-level **guard** means no ordinary user can approve their own listing or tamper with moderation — enforced no matter what the client sends.
- **Point + radius search** ("within 15 km of here") runs in the database via PostGIS, so it stays fast as listings grow.

## Making yourself an admin

After you sign up on the live site, run once:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

## Photos

Photo files live in a Supabase Storage bucket (created in Milestone 3); the
`pets.photos` array stores their URLs. Seed rows use a placeholder image.

> Validated against PostgreSQL's own grammar (all statements parse; PostGIS,
> generated columns, RLS policies, triggers, and the search function included).
