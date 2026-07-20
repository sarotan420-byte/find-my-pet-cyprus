import type { APIRoute } from 'astro';
import { searchPets } from '../../lib/pets';
import type { PetFilter, PetStatus, Species } from '../../lib/types';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams;
  const filter: PetFilter = {
    status: (p.get('status') as 'all' | PetStatus) || 'all',
    species: (p.get('species') as '' | Species) || '',
    area: p.get('area') || '',
    query: p.get('q') || '',
  };
  const lat = p.get('lat');
  const lng = p.get('lng');
  const radius = p.get('radius');
  if (lat && lng && radius) {
    filter.center = { lat: Number(lat), lng: Number(lng) };
    filter.radiusKm = Number(radius);
    // when searching by point, don't also text-filter by the place name
    filter.query = '';
  }
  try {
    const pets = await searchPets(filter);
    return new Response(JSON.stringify({ ok: true, pets }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('search failed', err);
    return new Response(JSON.stringify({ ok: false, error: 'Search failed.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
