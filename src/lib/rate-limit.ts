// Lightweight in-memory, per-key sliding-window rate limiter. Best-effort:
// state lives in one server instance, so it's a first line of defence layered
// with Turnstile + a honeypot + moderation. For strong global limits at scale,
// back this with Cloudflare KV (noted for post-launch hardening).
const store = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (store.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    store.set(key, hits);
    return false; // blocked
  }
  hits.push(now);
  store.set(key, hits);
  return true; // allowed
}

/** One-way hash of an IP (salted) so we can spot repeat flaggers without
 *  storing personal data. */
export async function hashIp(ip: string | null | undefined): Promise<string> {
  if (!ip) return 'unknown';
  const data = new TextEncoder().encode('fmp-cy-salt:' + ip);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
