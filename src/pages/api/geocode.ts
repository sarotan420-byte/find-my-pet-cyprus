import type { APIRoute } from 'astro';
import { geocodeCyprus } from '../../lib/geocode';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q') || '';
  const hit = await geocodeCyprus(q);
  if (!hit) {
    return new Response(JSON.stringify({ ok: false, error: 'Place not found in Cyprus.' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ ok: true, ...hit }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=86400',
    },
  });
};
