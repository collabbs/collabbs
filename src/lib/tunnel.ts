"use server";

import { createAdminClient } from "./supabase/admin";

/**
 * Compter les passages dans le tunnel d'entrée.
 *
 * ─── Pourquoi ça existe ───
 * On corrigeait à l'aveugle. Hier soir, les six pires cartes se sont
 * retrouvées en tête du paquet et personne ne l'a su avant que Julien ne le
 * voie de ses yeux. Une mesure aurait montré l'abandon dès la deuxième carte.
 *
 * ─── Ce qu'on n'enregistre pas ───
 * Ni adresse, ni identifiant de compte, ni page. Un jeton tiré au hasard dans
 * le navigateur, l'étape, le côté. De quoi compter des passages, pas de quoi
 * reconnaître quelqu'un — c'est la différence entre mesurer et surveiller.
 *
 * Ne lève jamais et n'attend rien : une mesure qui fait échouer ce qu'elle
 * mesure est pire que pas de mesure du tout.
 */

export type EtapeTunnel =
  | "tunnel_ouvert"
  | "cote_choisi"
  | "questionnaire_fini"
  | "defile_ouvert"
  | "relance_vue"
  | "inscription_cliquee";

export async function tracerEtape(
  etape: EtapeTunnel,
  session: string,
  cote?: string | null,
): Promise<void> {
  // Le jeton vient du navigateur : on le borne plutôt que de lui faire
  // confiance sur sa longueur.
  const jeton = typeof session === "string" ? session.slice(0, 64) : "";
  if (!jeton) return;

  try {
    const admin = createAdminClient();
    await admin
      .from("tunnel_evenements")
      .insert({ etape, session: jeton, cote: cote ?? null });
  } catch {
    /* voir l'en-tête : on ne casse pas un parcours pour un compteur */
  }
}
