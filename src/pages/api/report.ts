import type { APIRoute } from 'astro';
import { createPet, uploadPetPhotos, userIdFromToken } from '../../lib/pets';
import { centroidForArea } from '../../lib/areas';
import { verifyTurnstile } from '../../lib/turnstile';
import { rateLimit } from '../../lib/rate-limit';
import { notifyNewListing } from '../../lib/notify';

export const prerender = false; // server route

const MAX_PHOTOS = 3;
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB per file (after client-side compression)
const SPECIES = new Set(['Dog', 'Cat', 'Other']);

function bad(error: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad('Could not read the form.');
  }

  const s = (k: string) => (form.get(k) ?? '').toString().trim();

  // ── Anti-spam ──────────────────────────────────────────────────────────────
  // Rate limit: max 5 submissions per 10 minutes per IP.
  if (!rateLimit('report:' + (clientAddress || 'unknown'), 5, 10 * 60 * 1000)) {
    return bad('You’ve submitted a lot in a short time — please wait a few minutes.', 429);
  }

  const passed = await verifyTurnstile(s('cf-turnstile-response') || null, clientAddress);
  if (!passed) return bad('Spam check failed — please try again.', 403);

  // Honeypot: bots fill hidden fields humans never see.
  if (s('website')) return bad('Rejected.', 400);

  // ── Validate ─────────────────────────────────────────────────────────────
  const status = s('type');
  if (status !== 'missing' && status !== 'found') return bad('Choose missing or found.');
  const species = s('species');
  if (!SPECIES.has(species)) return bad('Choose a species.');
  const area = s('area');
  if (!area) return bad('Select an area.');
  const date = s('date');
  if (!date) return bad('Add the date seen.');
  const desc = s('desc');
  if (desc.length < 5) return bad('Add a short description.');
  const contactName = s('cname');
  const contactRaw = s('cphone');
  if (!contactName || !contactRaw) return bad('Add your name and a contact.');

  const looksEmail = contactRaw.includes('@');

  // ── Location (district centre for now; precise geocoding in Milestone 4) ───
  const { lat, lng } = centroidForArea(area);

  // ── Photos ─────────────────────────────────────────────────────────────────
  const files = form
    .getAll('photos')
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_PHOTOS);
  for (const f of files) {
    if (f.size > MAX_BYTES) return bad('One of the photos is too large.');
    if (!f.type.startsWith('image/')) return bad('Photos must be image files.');
  }

  // Link the listing to a signed-in reporter, if a valid token was sent.
  const authHeader = request.headers.get('authorization');
  const reporterId = await userIdFromToken(
    authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  );

  try {
    const photos = await uploadPetPhotos(files);
    const { id, persisted } = await createPet({
      reporterId,
      status,
      species,
      name: s('name'),
      breed: s('breed'),
      color: s('color'),
      area,
      postcode: s('postcode'),
      lat,
      lng,
      date,
      desc,
      photos,
      contactName,
      contactPhone: looksEmail ? undefined : contactRaw,
      contactEmail: looksEmail ? contactRaw : undefined,
    });
    if (persisted) {
      await notifyNewListing({ id, name: s('name') || 'Unnamed', species, area, status });
    }
    return new Response(JSON.stringify({ ok: true, id, persisted }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('report submission failed', err);
    return bad('Something went wrong saving your report. Please try again.', 500);
  }
};
