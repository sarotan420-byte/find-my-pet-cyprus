// Geocoding via OpenStreetMap Nominatim, scoped to Cyprus. Free, no API key.
// Called from the /api/geocode server route (so we can set a proper User-Agent
// per Nominatim's usage policy and cache results).

export interface GeoResult {
  lat: number;
  lng: number;
  label: string;
}

// Rough bounding box for the island (incl. north) — rejects off-island hits.
const CY_BOUNDS = { minLat: 34.5, maxLat: 35.75, minLng: 32.2, maxLng: 34.65 };

const cache = new Map<string, GeoResult | null>();

export async function geocodeCyprus(qRaw: string): Promise<GeoResult | null> {
  const q = (qRaw || '').trim();
  if (q.length < 2) return null;
  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const isPostcode = /^\d{3,5}$/.test(q);
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'cy',
    'accept-language': 'en',
  });
  if (isPostcode) params.set('postalcode', q);
  else params.set('q', `${q}, Cyprus`);

  let result: GeoResult | null = null;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'FindMyPetCyprus/1.0 (https://findmypetcyprus.com)',
        Accept: 'application/json',
      },
    });
    if (res.ok) {
      const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      const hit = data?.[0];
      if (hit) {
        const lat = Number(hit.lat);
        const lng = Number(hit.lon);
        if (
          lat >= CY_BOUNDS.minLat && lat <= CY_BOUNDS.maxLat &&
          lng >= CY_BOUNDS.minLng && lng <= CY_BOUNDS.maxLng
        ) {
          result = { lat, lng, label: hit.display_name };
        }
      }
    }
  } catch {
    result = null;
  }
  cache.set(key, result);
  return result;
}
