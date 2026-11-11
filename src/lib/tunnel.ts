"use server";

import { createAdminClient } from "./supabase/admin";
import { estUnCanal } from "./origine";

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
 * le navigateur, l'étape, le côté, et depuis le 11/11 une ÉTIQUETTE DE CANAL
 * — « tiktok », « createurs », « seo » — bornée à la liste de `lib/origine.ts`.
 * Pas de référent complet, pas d'identifiant publicitaire. De quoi compter des
 * passages, pas de quoi reconnaître quelqu'un — c'est la différence entre
 * mesurer et surveiller.
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
  origine?: string | null,
): Promise<void> {
  // Le jeton vient du navigateur : on le borne plutôt que de lui faire
  // confiance sur sa longueur.
  const jeton = typeof session === "string" ? session.slice(0, 64) : "";
  if (!jeton) return;

  try {
    const admin = createAdminClient();
    const base = { etape, session: jeton, cote: cote ?? null };
    // Borné : `utm_source` vient de l'URL, donc de n'importe qui. Une valeur
    // hors liste compte comme une arrivée directe plutôt que de polluer la
    // mesure.
    const canal = estUnCanal(origine) ? origine : null;

    const { error } = await admin.from("tunnel_evenements").insert({ ...base, origine: canal });

    /* ─── REPLI SI LA MIGRATION 0088 N'EST PAS ENCORE PASSÉE ───
       La colonne `origine` arrive avec la migration 0088. Entre un déploiement
       du code et son application, l'insertion échouerait sur une colonne
       inconnue — et comme cette fonction avale ses erreurs par conception, le
       tunnel aurait cessé de compter SANS QUE RIEN NE LE DISE. On réécrit donc
       sans la colonne plutôt que de perdre l'événement : une mesure sans
       canal vaut mieux que pas de mesure.
       Le projet a déjà ce motif pour la migration 0037 (`creators-data.ts`). */
    if (error) await admin.from("tunnel_evenements").insert(base);
  } catch {
    /* voir l'en-tête : on ne casse pas un parcours pour un compteur */
  }
}
