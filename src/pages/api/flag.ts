import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { rateLimit, hashIp } from '../../lib/rate-limit';

export const prerender = false;

const REASONS = new Set(['spam', 'inaccurate', 'duplicate', 'inappropriate', 'other']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ ok: false, error: 'Bad request.' }, 400); }

  if ((form.get('website') ?? '').toString()) return json({ ok: false, error: 'Rejected.' }, 400); // honeypot

  const petId = Number(form.get('pet_id'));
  const reason = (form.get('reason') ?? '').toString();
  const note = (form.get('note') ?? '').toString().slice(0, 500);
  if (!petId || !REASONS.has(reason)) return json({ ok: false, error: 'Invalid report.' }, 400);

  if (!rateLimit('flag:' + (clientAddress || 'unknown'), 10, 60 * 60 * 1000)) {
    return json({ ok: false, error: 'Too many reports — please try later.' }, 429);
  }

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.from('reports').insert({
      pet_id: petId,
      reason,
      note: note || null,
      reporter_hash: await hashIp(clientAddress),
    });
    if (error) return json({ ok: false, error: 'Could not submit report.' }, 500);
  }
  return json({ ok: true });
};
