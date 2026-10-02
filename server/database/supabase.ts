import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client for server-side data access (Phase 1 migration).
 *
 * Uses the SERVICE_ROLE key, which bypasses RLS — the same trust level the
 * old code had via the Firebase Admin SDK. Never expose this client to the
 * browser bundle; it is server-only.
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (AI Studio / Cloud Run env vars; see docs/SUPABASE.md when present.)
 */

let client: SupabaseClient | null = null;
let warnedUnconfigured = false;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_URL.trim() !== '' &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim() !== ''
  );
}

/**
 * Returns the shared service-role Supabase client.
 * Throws a clear error when env is missing — DAOs catch this and fall back
 * to the local JSON store, exactly like the old Firestore-missing path.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!isSupabaseConfigured()) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn(
        '[Supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — data layer running on local JSON fallback only.'
      );
    }
    throw new Error('Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)');
  }
  client = createClient(
    process.env.SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-client-info': 'bsenexus-server' } },
    }
  );
  return client;
}

/** For tests: reset the cached client. */
export function resetSupabaseClient(): void {
  client = null;
  warnedUnconfigured = false;
}
