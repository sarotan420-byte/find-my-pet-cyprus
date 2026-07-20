-- ============================================================================
-- Find My Pet Cyprus — 04 seed (demo listings, already approved)
-- Optional: gives the live site the same 6 sample pets as local dev.
-- Safe to skip in production, or delete these rows later.
-- ============================================================================

insert into public.pets
  (status, species, name, breed, color, area, lat, lng, date_seen, description, photo_url, photos, contact_name, moderation_status)
values
  ('missing','Dog','Bella','Mixed breed, medium','Brown & white','Limassol — Agios Nikolaos',34.684,33.045,'2026-07-09','Last seen near the church, wearing a red collar with no tag. Nervous around strangers — please do not chase, call our number instead.','/assets/photo.jpg', array['/assets/photo.jpg'],'Maria','approved'),
  ('found','Cat','Unnamed','Domestic shorthair','Grey tabby','Nicosia — Strovolos',35.146,33.325,'2026-07-11','Friendly, well fed, no collar. Been sleeping in our garden for two nights. Likely someone''s pet, not a stray.','/assets/photo.jpg', array['/assets/photo.jpg'],'Andreas','approved'),
  ('missing','Dog','Zeus','German Shepherd','Black & tan','Larnaca — Finikoudes',34.917,33.639,'2026-07-12','Slipped his lead near the seafront during the fireworks. Microchipped. Very friendly, will approach people.','/assets/photo.jpg', array['/assets/photo.jpg'],'Costas','approved'),
  ('found','Dog','Unnamed','Small terrier mix','White with brown patches','Paphos — Kato Paphos',34.753,32.407,'2026-07-08','Found wandering near the harbour, clean and clearly cared for. Currently safe with us.','/assets/photo.jpg', array['/assets/photo.jpg'],'Elena','approved'),
  ('missing','Cat','Luna','Domestic longhair','White & ginger','Limassol — Germasogeia',34.702,33.115,'2026-07-10','Indoor cat, escaped through a balcony door. Skittish — please don''t approach, just note the location and call.','/assets/photo.jpg', array['/assets/photo.jpg'],'Sophia','approved'),
  ('found','Dog','Unnamed','Hound mix','Tan','Ammochostos — Paralimni',35.038,33.983,'2026-07-12','Thin, hungry, no collar or chip found at the vet check. Currently in foster care.','/assets/photo.jpg', array['/assets/photo.jpg'],'Marios','approved');
