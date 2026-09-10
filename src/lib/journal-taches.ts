import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Le passage d'une tâche planifiée, noté qu'elle ait eu du travail ou non.
 *
 * ─── Pourquoi ça n'allait pas sans ───
 * Un automate qui tourne sans rien avoir à faire ne laisse aucune trace —
 * exactement comme un automate qui ne tourne pas. Le silence a deux causes
 * possibles, et rien ne permettait de les distinguer. C'est ce qui a permis au
 * rappel du défilé de n'envoyer aucun email pendant des jours en se déclarant
 * en bonne santé, et c'est ce qui rendait impossible de répondre à « est-ce que
 * la libération automatique du séquestre s'exécute vraiment ? » — un engagement
 * pourtant écrit dans le contrat des créateurs.
 *
 * Les journaux de la plateforme d'hébergement ne suffisent pas : courts sur un
 * plan Hobby, et consultables seulement à la main. Le produit garde donc sa
 * propre mémoire.
 *
 * ─── Ce que ça ne fait pas ───
 * Échouer. Noter un passage ne doit jamais empêcher la tâche de répondre : si
 * l'écriture rate, la réponse part quand même.
 */
export async function repondreEtNoter(
  tache: string,
  debut: number,
  corps: Record<string, unknown>,
): Promise<NextResponse> {
  try {
    await createAdminClient()
      .from("journal_taches")
      .insert({
        tache,
        ok: corps.ok !== false,
        resultat: corps as never,
        duree_ms: Date.now() - debut,
      });
  } catch {
    /* Le journal est un confort, pas une dépendance. */
  }
  return NextResponse.json(corps);
}
