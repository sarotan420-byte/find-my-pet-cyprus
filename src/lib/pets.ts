import type { Pet, PetFilter } from './types';
import { DEMO_PETS } from './demo-data';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { getSupabaseAdmin } from './supabase-admin';

// ── Data-access layer ────────────────────────────────────────────────────────
// Every page/route reads listings through these functions, so swapping demo
// data for the live database (Milestone 2) happens here and nowhere else.

const demoSorted = () =>
  [...DEMO_PETS].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

/** All publicly visible (moderation-approved) listings, newest first.
 *  Fails soft: if the database is unreachable, returns demo data rather than
 *  throwing (keeps builds and pages resilient). */
export async function getApprovedPets(): Promise<Pet[]> {
  const supabase = getSupabase();
  if (!supabase) return demoSorted();
  try {
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('moderation_status', 'approved')
      .order('date_seen', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToPet);
  } catch {
    return demoSorted();
  }
}

export async function getPetById(id: string | number): Promise<Pet | null> {
  const supabase = getSupabase();
  if (!supabase) return DEMO_PETS.find((p) => String(p.id) === String(id)) ?? null;
  try {
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('id', id)
      .eq('moderation_status', 'approved')
      .maybeSingle();
    if (error) throw error;
    return data ? rowToPet(data) : null;
  } catch {
    return DEMO_PETS.find((p) => String(p.id) === String(id)) ?? null;
  }
}

/** Search approved listings by attributes + optional point/radius.
 *  Uses the PostGIS `search_pets` RPC when the database is live; otherwise
 *  filters the demo data in memory so the same call works in local dev. */
export async function searchPets(f: PetFilter): Promise<Pet[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.rpc('search_pets', {
      p_status: f.status ?? null,
      p_species: f.species ?? null,
      p_area: f.area ?? null,
      p_query: f.query ?? null,
      p_lat: f.center?.lat ?? null,
      p_lng: f.center?.lng ?? null,
      p_radius_km: f.radiusKm ?? null,
    });
    if (error) throw error;
    return (data ?? []).map(rowToPet);
  }
  const all = await getApprovedPets();
  return filterPets(all, f);
}

/** Insert a new listing as `pending`. Server-only. Returns the new id.
 *  Falls back to a demo id when no database is configured (local dev). */
export async function createPet(input: {
  status: 'missing' | 'found';
  species: string;
  name?: string;
  breed?: string;
  color?: string;
  area: string;
  postcode?: string;
  lat: number;
  lng: number;
  date: string;
  desc: string;
  photos?: string[];
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  reporterId?: string | null;
}): Promise<{ id: string | number; persisted: boolean }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { id: 'demo', persisted: false };
  const { data, error } = await admin
    .from('pets')
    .insert({
      reporter_id: input.reporterId ?? null,
      status: input.status,
      species: input.species,
      name: input.name?.trim() || 'Unnamed',
      breed: input.breed ?? '',
      color: input.color ?? '',
      area: input.area,
      postcode: input.postcode ?? null,
      lat: input.lat,
      lng: input.lng,
      date_seen: input.date,
      description: input.desc,
      photos: input.photos ?? [],
      photo_url: input.photos?.[0] ?? null,
      contact_name: input.contactName ?? null,
      contact_phone: input.contactPhone ?? null,
      contact_email: input.contactEmail ?? null,
      moderation_status: 'pending',
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id, persisted: true };
}

/** Upload compressed photo blobs to Storage; returns their public URLs.
 *  No-op (empty) when Storage isn't configured. Server-only. */
export async function uploadPetPhotos(files: File[]): Promise<string[]> {
  const admin = getSupabaseAdmin();
  if (!admin || !files.length) return [];
  const urls: string[] = [];
  for (const f of files) {
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
    const { error } = await admin.storage
      .from('pet-photos')
      .upload(path, f, { contentType: f.type || 'image/jpeg', upsert: false });
    if (error) throw error;
    const { data } = admin.storage.from('pet-photos').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

/** Verify a Supabase access token and return the user id, or null. Server-only. */
export async function userIdFromToken(token: string | null): Promise<string | null> {
  if (!token) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data.user?.id ?? null;
}

/** Moderation queue — pending listings. Server-only (service role). */
export async function getPendingPets(): Promise<Pet[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from('pets')
    .select('*')
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToPet);
}

/** Client-safe in-memory filter — mirrors the prototype's search behaviour.
 *  Radius filtering is applied when a center point is supplied. */
export function filterPets(pets: Pet[], f: PetFilter): Pet[] {
  return pets.filter((p) => {
    if (f.status && f.status !== 'all' && p.status !== f.status) return false;
    if (f.species && p.species !== f.species) return false;
    if (f.area) {
      const head = f.area.split(' ')[0];
      if (p.area.indexOf(f.area) !== 0 && p.area.indexOf(head) === -1) return false;
    }
    if (f.query) {
      const q = f.query.trim().toLowerCase();
      if (
        q &&
        p.area.toLowerCase().indexOf(q) === -1 &&
        p.name.toLowerCase().indexOf(q) === -1
      )
        return false;
    }
    if (f.center && f.radiusKm) {
      if (haversineKm(f.center, { lat: p.lat, lng: p.lng }) > f.radiusKm) return false;
    }
    return true;
  });
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Maps a DB row (snake_case, PostGIS point) to the Pet shape the UI uses.
function rowToPet(row: any): Pet {
  return {
    id: row.id,
    status: row.status,
    species: row.species,
    name: row.name || 'Unnamed',
    breed: row.breed || '',
    color: row.color || '',
    area: row.area || '',
    lat: row.lat ?? row.location?.coordinates?.[1],
    lng: row.lng ?? row.location?.coordinates?.[0],
    date: (row.date_seen || '').slice(0, 10),
    desc: row.description || '',
    photo: row.photo_url || '/assets/photo.jpg',
    contactName: row.contact_name || '',
  };
}

export { isSupabaseConfigured };
