// Optional admin email notification via Resend. No-op unless RESEND_API_KEY and
// ADMIN_EMAIL are configured, so it's safe in dev and doesn't block submissions.
export async function notifyNewListing(pet: {
  id: string | number;
  name: string;
  species: string;
  area: string;
  status: string;
}): Promise<void> {
  const key = import.meta.env.RESEND_API_KEY as string | undefined;
  const to = import.meta.env.ADMIN_EMAIL as string | undefined;
  const from = (import.meta.env.NOTIFY_FROM as string | undefined) || 'alerts@findmypetcy.com';
  const site = (import.meta.env.PUBLIC_SITE_URL as string | undefined) || 'https://www.findmypetcy.com';
  if (!key || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `New ${pet.status} listing to review: ${pet.name}`,
        text: `A new listing is pending moderation.\n\n${pet.name} — ${pet.species} in ${pet.area}\n\nReview it: ${site}/admin`,
      }),
    });
  } catch {
    // never let a notification failure break a submission
  }
}
