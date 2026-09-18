import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report-error";

/**
 * La campagne qui porte une collaboration en affiliation directe.
 *
 * ─── Pourquoi une campagne existe derrière un deal ───
 * L'affiliation a besoin d'un lien tracké, d'une fenêtre d'attribution, d'un
 * taux et d'une destination. Toute la chaîne de l'argent lit ces choses dans
 * une CAMPAGNE : le clic (`/r/[code]`), la vente (`/api/track`), le calcul de
 * commission, la réservation sur la provision, le versement au créateur.
 *
 * Apprendre à cette chaîne à lire aussi un deal reviendrait à écrire deux fois
 * le circuit de l'argent — c'est exactement la faute qui a coûté le plus cher
 * dans ce produit à chaque fois qu'elle a été commise.
 *
 * ─── Ce qui la distingue d'une vraie campagne ───
 * Elle est PRIVÉE : invisible au catalogue, absente du défilé, hors du plafond
 * de plan de la marque. Ce n'est pas une offre ouverte, c'est le véhicule
 * technique d'un accord déjà conclu entre deux personnes.
 */

export async function creerCampagnePrivee(params: {
  brandId: string;
  nom: string;
  commission: number;
  urlDestination: string;
  description: string | null;
}): Promise<{ ok: true; campaignId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("campaigns")
    .insert({
      brand_id: params.brandId,
      name: params.nom,
      description: params.description,
      type: "affiliation",
      privee: true,
      status: "active",
      commission_type: "percentage",
      commission_value: params.commission,
      // Le même taux quelle que soit la taille d'audience : on négocie avec une
      // personne, pas avec une grille.
      commission_nano: params.commission,
      commission_micro: params.commission,
      commission_mid: params.commission,
      commission_macro: params.commission,
      target_url: params.urlDestination,
      // Un seul créateur, et il est déjà choisi.
      spots: 1,
    })
    .select("id")
    .single();

  if (error || !data) {
    await reportError("affiliation-directe/campagne", error ?? "insertion vide", {
      userId: params.brandId,
    });
    return {
      ok: false,
      error: "Le suivi des ventes n'a pas pu être préparé. Réessaie.",
    };
  }
  return { ok: true, campaignId: data.id };
}

/**
 * Met à jour la campagne privée quand la marque révise ses termes.
 *
 * Tant que le créateur n'a pas accepté, le taux et la destination se
 * renégocient. Après, le lien est diffusé et ses ventes tombent : les changer
 * reviendrait à modifier le prix d'un travail déjà commencé.
 */
export async function majCampagnePrivee(
  campaignId: string,
  params: { commission: number; urlDestination: string; description: string | null },
): Promise<{ ok: boolean }> {
  const { error } = await createAdminClient()
    .from("campaigns")
    .update({
      commission_value: params.commission,
      commission_nano: params.commission,
      commission_micro: params.commission,
      commission_mid: params.commission,
      commission_macro: params.commission,
      target_url: params.urlDestination,
      description: params.description,
    })
    .eq("id", campaignId)
    .eq("privee", true);
  if (error) {
    await reportError("affiliation-directe/maj", error, { detail: campaignId });
    return { ok: false };
  }
  return { ok: true };
}

/** Ferme la campagne privée d'une collaboration annulée : plus rien à tracker. */
export async function cloreCampagnePrivee(campaignId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("campaigns")
    .update({ status: "ended" })
    .eq("id", campaignId)
    .eq("privee", true);
  // Une campagne privée restée ouverte continuerait d'attribuer des ventes à
  // une collaboration annulée — donc à engager la provision de la marque.
  if (error) await reportError("affiliation-directe/cloture", error, { detail: campaignId });
}
