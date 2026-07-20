export type PetStatus = 'missing' | 'found' | 'reunited';
export type Species = 'Dog' | 'Cat' | 'Other';

export interface Pet {
  id: number | string;
  status: PetStatus;
  species: Species;
  name: string;
  breed: string;
  color: string;
  area: string;
  lat: number;
  lng: number;
  date: string; // ISO date (YYYY-MM-DD)
  desc: string;
  photo: string;
  contactName: string;
}

export interface PetFilter {
  status?: 'all' | PetStatus;
  species?: '' | Species;
  area?: string;
  /** free text: postcode or place name */
  query?: string;
  /** point + radius filtering (km) — used once geocoding is wired */
  center?: { lat: number; lng: number };
  radiusKm?: number;
}

export type ModerationStatus = 'pending' | 'approved' | 'rejected';

/** Shape submitted by the report form (Milestone 3). */
export interface NewPet {
  status: Exclude<PetStatus, 'reunited'>;
  species: Species;
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
}

export interface SavedSearch {
  id: string;
  label: string;
  filters: PetFilter;
  created_at: string;
}

export interface Report {
  id: string;
  pet_id: number | string;
  reason: string;
  note?: string;
  resolved: boolean;
  created_at: string;
}
