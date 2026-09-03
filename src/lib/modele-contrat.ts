import type { ContractSnapshot, PartySnapshot } from "./contract-snapshot";

/**
 * Modèle de contrat vierge, conforme au décret n° 2025-1137.
 *
 * Le décret impose un contrat écrit dès 1 000 € HT cumulés sur l'année civile
 * entre un annonceur et un créateur — mais il n'impose à personne de le
 * fournir. Un créateur qui découvre l'obligation n'a donc, aujourd'hui, aucun
 * endroit où trouver le document. C'est ce vide que ce modèle comble.
 *
 * Il réutilise EXACTEMENT le moteur des contrats réels
 * (`buildContractDocument`) plutôt qu'un texte parallèle : un modèle qui
 * diverge du contrat que la plateforme émet vraiment serait pire qu'aucun
 * modèle. Les valeurs sont remplacées par des marqueurs à compléter.
 */

/** Marqueur visible, à remplacer par la personne qui utilise le modèle. */
function aCompleter(quoi: string): string {
  return `[${quoi}]`;
}

function partieVierge(role: "annonceur" | "créateur"): PartySnapshot {
  const majuscule = role === "annonceur" ? "ANNONCEUR" : "CRÉATEUR";
  return {
    user_id: `modele-${role}`,
    display_name: aCompleter(`Nom de l'${role === "annonceur" ? "annonceur" : "créateur"}`),
    legal_status_label: aCompleter(`Statut juridique de l'${majuscule}`),
    legal_name: aCompleter(`Dénomination sociale de l'${majuscule}`),
    rep_name: aCompleter("Nom du représentant"),
    address: aCompleter("Adresse"),
    city: aCompleter("Ville"),
    zip: aCompleter("Code postal"),
    country: "France",
    siret: aCompleter("SIRET"),
    vat: aCompleter("N° de TVA intracommunautaire"),
    contact_email: aCompleter("Adresse e-mail"),
  };
}

/**
 * Snapshot d'un contrat vierge, en régime COMPLET.
 *
 * Le régime complet est celui qui s'applique au-delà du seuil — donc celui
 * dont a besoin quelqu'un qui vient de découvrir qu'il l'a franchi. Le régime
 * simplifié, lui, n'a pas d'obligation à satisfaire : personne ne va chercher
 * un modèle pour un document que la loi n'exige pas.
 */
export function snapshotModele(): ContractSnapshot {
  return {
    version: 1,
    // Date neutre : ce document n'est pas daté, c'est un modèle. La valeur ne
    // sert qu'à satisfaire le type, elle n'est jamais affichée comme une date
    // de signature.
    generated_at: "1970-01-01T00:00:00.000Z",
    regime: "complete",
    brand: partieVierge("annonceur"),
    creator: partieVierge("créateur"),
    deal: {
      title: aCompleter("Objet de la collaboration"),
      amount: 0,
      format: "video_post",
      platform_id: null,
      quantity: 1,
      deadline: null,
      brand_notes: null,
      exclusivity: false,
      exclusivity_days: null,
      usage_rights_months: null,
      usage_rights_scope: null,
      usage_rights_fee: null,
      platform_fee_rate: null,
    },
  };
}

/** Référence affichée en tête du modèle. */
export const REFERENCE_MODELE = "MODÈLE";
