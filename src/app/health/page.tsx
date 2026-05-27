/**
 * Temporary health-check page.
 *
 * Proves that the Supabase JS SDK is wired correctly by issuing a trivial query
 * against a fictive table. Postgres replies with code 42P01 ("relation does not
 * exist") or PostgREST replies with PGRST205, both of which mean the request
 * reached the database — only the table is missing. That's what we want to see.
 *
 * Visit http://localhost:3000/health during development.
 * Delete this route once Supabase usage is mature and covered by other code.
 */

import { supabase } from "@/lib/supabase";

// Force dynamic rendering so env vars are read at request time, not build time.
export const dynamic = "force-dynamic";

type HealthState =
  | { ok: true; detail: string }
  | { ok: false; reason: string };

const PROBE_TABLE = "_collabbs_health_probe_table_does_not_exist";

// Postgres / PostgREST codes that mean "the round-trip worked, the table is
// just missing" — exactly what we expect for a probe of a non-existent table.
const EXPECTED_MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

async function checkSupabase(): Promise<HealthState> {
  try {
    const { error } = await supabase.from(PROBE_TABLE).select("*").limit(0);

    if (!error) {
      // Shouldn't happen (the table is intentionally fictive), but it would
      // still mean the connection works.
      return { ok: true, detail: "round-trip OK (probe table unexpectedly exists)" };
    }

    if (EXPECTED_MISSING_TABLE_CODES.has(error.code ?? "")) {
      return {
        ok: true,
        detail: `round-trip OK (API responded ${error.code}: probe table missing as expected)`,
      };
    }

    return { ok: false, reason: `${error.code ?? "?"}: ${error.message}` };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

export default async function HealthPage() {
  const state = await checkSupabase();
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(not set)";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-8 font-sans dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Collabbs · Health check
      </h1>

      <section
        className={`w-full max-w-xl rounded-lg p-6 ${
          state.ok
            ? "bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200"
            : "bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200"
        }`}
      >
        <p className="text-xl font-semibold">
          {state.ok ? "✅ Supabase connecté" : "❌ Erreur Supabase"}
        </p>
        <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-mono text-sm">
          <dt className="opacity-60">URL</dt>
          <dd className="break-all">{projectUrl}</dd>
          {state.ok ? (
            <>
              <dt className="opacity-60">Detail</dt>
              <dd>{state.detail}</dd>
            </>
          ) : (
            <>
              <dt className="opacity-60">Reason</dt>
              <dd className="break-all">{state.reason}</dd>
            </>
          )}
        </dl>
      </section>

      <p className="max-w-md text-center text-sm text-zinc-500">
        Page temporaire pour valider la connexion Supabase. À supprimer une fois
        le projet stabilisé.
      </p>
    </main>
  );
}
