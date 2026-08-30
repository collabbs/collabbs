import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Signale une erreur de production.
 *
 * Le code appelait `console.error` sur des chemins qui touchent à l'argent —
 * versement impossible, séquestre non enregistré, crédit CPA en échec. En
 * production ces lignes partent dans les journaux Vercel, que personne ne
 * consulte et que le plan gratuit ne conserve pas longtemps. Si quelque chose
 * cassait, personne ne l'apprenait.
 *
 * Cette fonction garde l'erreur DANS le produit, visible depuis l'écran
 * d'administration, et continue de l'écrire dans la console — les deux
 * servent : la console pour déboguer en direct, la table pour ne rien perdre.
 *
 * Elle n'échoue jamais : signaler une erreur ne doit pas en provoquer une
 * seconde, ni interrompre ce que l'appelant était en train de faire.
 */
export async function reportError(
  context: string,
  error: unknown,
  meta?: { userId?: string; detail?: string },
): Promise<void> {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error)?.slice(0, 300) ?? "Erreur inconnue";

  // Toujours la console : c'est ce qu'on lit en développement et dans les
  // journaux de la plateforme.
  console.error(`[${context}]`, error, meta?.detail ?? "");

  const detail = [
    meta?.detail,
    error instanceof Error && error.stack ? error.stack : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const admin: any = createAdminClient();
    await admin.rpc("report_error", {
      p_context: context,
      // Le message sert de clé de regroupement : on retire les identifiants
      // pour qu'une même panne ne crée pas mille lignes distinctes.
      p_message: normalizeMessage(message),
      p_detail: detail || null,
      p_user: meta?.userId ?? null,
    });
  } catch {
    // Signaler une erreur ne doit jamais en provoquer une autre. Si la base
    // est justement ce qui est cassé, la console reste.
  }
}

/**
 * Remplace ce qui varie d'une occurrence à l'autre — identifiants, montants,
 * horodatages — pour que deux occurrences de la même panne se regroupent.
 */
export function normalizeMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b(pi|ch|acct|cs|tr|in|sub)_[A-Za-z0-9]{6,}/g, "<ref>")
    .replace(/\b\d{4}-\d{2}-\d{2}T[\d:.]+Z?\b/g, "<date>")
    // Les milliers français sont séparés par une espace fine insécable
    // (U+202F) ou insécable (U+00A0) : sans elles, « 1 400,00 € » ne serait
    // gommé qu'à moitié et laisserait un « 1 » qui casse le regroupement.
    .replace(/\d[\d\s\u00A0\u202F]*([.,]\d+)?\s*€/g, "<montant>")
    .slice(0, 500);
}
