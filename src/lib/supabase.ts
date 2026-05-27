/**
 * Supabase browser-safe client.
 *
 * Uses the publishable key, which is exposed to browsers. All access is gated by
 * Postgres Row Level Security (RLS) policies — never disable RLS on a table that
 * holds user data.
 *
 * For server-side admin operations that need to bypass RLS (migrations, cron jobs,
 * webhook handlers), build a separate client with SUPABASE_SECRET_KEY. Do NOT
 * import that client into a file that can run in the browser.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing Supabase env vars. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set in .env.local",
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
