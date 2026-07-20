import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// SERVER-ONLY client using the service-role key. It bypasses Row Level Security,
// so it must never be imported into client-side code. Used by the moderation
// dashboard (Milestone 6) and any trusted server action.
const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

export const isAdminConfigured = Boolean(url && serviceKey);

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isAdminConfigured) return null;
  if (!_admin) {
    _admin = createClient(url!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _admin;
}
