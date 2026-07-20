// Cloudflare Turnstile — server-side verification of the anti-spam token.
// When no secret is configured (local dev), verification is skipped so the
// form still works end-to-end.
export async function verifyTurnstile(token: string | null, ip?: string | null): Promise<boolean> {
  const secret = import.meta.env.TURNSTILE_SECRET_KEY as string | undefined;
  if (!secret) return true; // dev / not-yet-configured
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = (await res.json()) as { success: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export const isTurnstileConfigured = Boolean(
  import.meta.env.PUBLIC_TURNSTILE_SITE_KEY
);
