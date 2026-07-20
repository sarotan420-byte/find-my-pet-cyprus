import type { Pet } from './types';

// Ported from the prototype's data.js. In production these come from the
// moderation-approved listings in Supabase (see pets.ts). Kept for local dev,
// previews, and as a fallback when no database is configured.
export const DEMO_PETS: Pet[] = [
  { id: 1, status: 'missing', species: 'Dog', name: 'Bella', breed: 'Mixed breed, medium', color: 'Brown & white', area: 'Limassol — Agios Nikolaos', lat: 34.684, lng: 33.045, date: '2026-07-09', desc: 'Last seen near the church, wearing a red collar with no tag. Nervous around strangers — please do not chase, call our number instead.', photo: '/assets/photo.jpg', contactName: 'Maria' },
  { id: 2, status: 'found', species: 'Cat', name: 'Unnamed', breed: 'Domestic shorthair', color: 'Grey tabby', area: 'Nicosia — Strovolos', lat: 35.146, lng: 33.325, date: '2026-07-11', desc: 'Friendly, well fed, no collar. Been sleeping in our garden for two nights. Likely someone’s pet, not a stray.', photo: '/assets/photo.jpg', contactName: 'Andreas' },
  { id: 3, status: 'missing', species: 'Dog', name: 'Zeus', breed: 'German Shepherd', color: 'Black & tan', area: 'Larnaca — Finikoudes', lat: 34.917, lng: 33.639, date: '2026-07-12', desc: 'Slipped his lead near the seafront during the fireworks. Microchipped. Very friendly, will approach people.', photo: '/assets/photo.jpg', contactName: 'Costas' },
  { id: 4, status: 'found', species: 'Dog', name: 'Unnamed', breed: 'Small terrier mix', color: 'White with brown patches', area: 'Paphos — Kato Paphos', lat: 34.753, lng: 32.407, date: '2026-07-08', desc: 'Found wandering near the harbour, clean and clearly cared for. Currently safe with us.', photo: '/assets/photo.jpg', contactName: 'Elena' },
  { id: 5, status: 'missing', species: 'Cat', name: 'Luna', breed: 'Domestic longhair', color: 'White & ginger', area: 'Limassol — Germasogeia', lat: 34.702, lng: 33.115, date: '2026-07-10', desc: 'Indoor cat, escaped through a balcony door. Skittish — please don’t approach, just note the location and call.', photo: '/assets/photo.jpg', contactName: 'Sophia' },
  { id: 6, status: 'found', species: 'Dog', name: 'Unnamed', breed: 'Hound mix', color: 'Tan', area: 'Ammochostos — Paralimni', lat: 35.038, lng: 33.983, date: '2026-07-12', desc: 'Thin, hungry, no collar or chip found at the vet check. Currently in foster care.', photo: '/assets/photo.jpg', contactName: 'Marios' },
];
