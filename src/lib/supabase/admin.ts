import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Client Supabase service-role (BYPASS RLS).
 * Usage backend uniquement — ex. écrire des événements de tracking
 * (affiliate_events) qui sont interdits en écriture aux rôles anon/authenticated.
 * Ne JAMAIS exposer la clé secrète côté navigateur.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
