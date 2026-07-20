import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Reads env at runtime. Until Supabase is configured (Milestone 2/8) these are
// empty and the app falls back to demo data — see pets.ts.
const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

let _client: SupabaseClient | null = null;

/** Browser/anon client (respects Row Level Security). */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!_client) _client = createClient(url!, anonKey!);
  return _client;
}
