// Cyprus districts used in the area / town filter and the report form.
export const AREAS: string[] = [
  'Nicosia',
  'Limassol',
  'Larnaca',
  'Paphos',
  'Ammochostos (Famagusta)',
  'Kyrenia',
];

// Approximate district centres. Until precise geocoding / pin-drop lands
// (Milestone 4), a submitted listing is placed at its district centre so it
// still appears on the map. Keyed by the leading word of the area label.
export const DISTRICT_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  Nicosia: { lat: 35.1856, lng: 33.3823 },
  Limassol: { lat: 34.7071, lng: 33.0226 },
  Larnaca: { lat: 34.9182, lng: 33.6201 },
  Paphos: { lat: 34.7754, lng: 32.4245 },
  Ammochostos: { lat: 35.0386, lng: 33.9611 },
  Kyrenia: { lat: 35.3364, lng: 33.3182 },
};

/** Best-effort district centre for an area label like "Limassol — Germasogeia". */
export function centroidForArea(area: string): { lat: number; lng: number } {
  const head = (area || '').split(/[\s—-]/)[0].trim();
  return DISTRICT_CENTROIDS[head] ?? { lat: 34.98, lng: 33.15 }; // island centre
}

// District metadata for SEO landing pages (/area/<slug>).
export interface District {
  slug: string;
  /** short public name used in copy/titles */
  short: string;
  /** the option label used in filters (matches pet.area prefix) */
  label: string;
  /** leading word of area labels, used to match listings */
  head: string;
  lat: number;
  lng: number;
}

export const DISTRICTS: District[] = [
  { slug: 'nicosia', short: 'Nicosia', label: 'Nicosia', head: 'Nicosia', ...DISTRICT_CENTROIDS.Nicosia },
  { slug: 'limassol', short: 'Limassol', label: 'Limassol', head: 'Limassol', ...DISTRICT_CENTROIDS.Limassol },
  { slug: 'larnaca', short: 'Larnaca', label: 'Larnaca', head: 'Larnaca', ...DISTRICT_CENTROIDS.Larnaca },
  { slug: 'paphos', short: 'Paphos', label: 'Paphos', head: 'Paphos', ...DISTRICT_CENTROIDS.Paphos },
  { slug: 'famagusta', short: 'Famagusta', label: 'Ammochostos (Famagusta)', head: 'Ammochostos', ...DISTRICT_CENTROIDS.Ammochostos },
  { slug: 'kyrenia', short: 'Kyrenia', label: 'Kyrenia', head: 'Kyrenia', ...DISTRICT_CENTROIDS.Kyrenia },
];

export function districtBySlug(slug: string): District | null {
  return DISTRICTS.find((d) => d.slug === slug) ?? null;
}

export function petMatchesDistrict(area: string, d: District): boolean {
  return (area || '').split(/[\s—-]/)[0].trim() === d.head;
}
