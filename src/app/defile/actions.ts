"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ce qui a défilé, retenu côté serveur pour ceux qui ont un compte.
 *
 * ─── Pourquoi les deux mémoires ───
 * Le défilé s'utilise AVANT d'avoir un compte : la mémoire vit donc d'abord
 * dans le navigateur, et c'est irréductible. Mais une fois connecté, elle doit
 * suivre la personne — sinon le paquet repart de zéro sur son deuxième
 * téléphone et lui remontre ce qu'elle a déjà écarté.
 *
 * Et sans cette mémoire côté serveur, aucun rappel n'est possible : on ne peut
 * pas écrire « 35 nouvelles t'attendent » à quelqu'un dont on ignore ce qu'il
 * a vu.
 *
 * Ne lève jamais : perdre une ligne de mémoire est regrettable, casser un
 * défilé pour ça ne l'est pas.
 */
export async function enregistrerVues(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // La liste vient du navigateur : on la borne et on la nettoie.
    const propres = [...new Set(ids)]
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
      .slice(0, 500);
    if (propres.length === 0) return;

    const admin = createAdminClient();
    await admin.from("cartes_vues").upsert(
      propres.map((cible_id) => ({ viewer_id: user.id, cible_id })),
      { onConflict: "viewer_id,cible_id", ignoreDuplicates: true },
    );
  } catch {
    /* voir l'en-tête */
  }
}
