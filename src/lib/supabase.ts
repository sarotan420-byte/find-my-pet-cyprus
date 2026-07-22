import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// These two values are PUBLIC by design — the anon/publishable key is meant to
// ship in the browser and is protected by Row Level Security. They're baked in
// as defaults so the client always works, regardless of the host's build-time
// env handling. An env var, if present at build, still takes precedence.
const PUBLIC_URL_DEFAULT = 'https://gacmwporrxlkqigklopb.supabase.co';
const PUBLIC_ANON_DEFAULT = 'sb_publishable_difmH5JmR0oEfGs-myi6AA_7OL3PFxb';

const url =
  (import.meta.env.PUBLIC_SUPABASE_URL as string | undefined) || PUBLIC_URL_DEFAULT;
const anonKey =
  (import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined) || PUBLIC_ANON_DEFAULT;

export const isSupabaseConfigured = Boolean(url && anonKey);

let _client: SupabaseClient | null = null;

/** Browser/anon client (respects Row Level Security). */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!_client) _client = createClient(url!, anonKey!);
  return _client;
}
