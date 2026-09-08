/**
 * Vocabulaire partagé des collaborations.
 *
 * ⚠️ Ce fichier n'a PAS de `server-only`, et c'est sa raison d'être. Les
 * libellés vivaient dans `defile.ts`, qui lit la base et porte donc cette
 * directive : les importer depuis un composant de navigateur faisait échouer
 * l'assemblage — `tsc` ne voit rien, seul le bundler le rattrape.
 *
 * Tout ce qui doit traverser la frontière serveur / navigateur se met ici.
 */
export const LIBELLES_TYPE: Record<string, string> = {
  video: "Vidéo postée",
  ugc: "Contenu UGC",
  affiliation: "Affiliation",
  performance: "Paiement à la performance",
  hybrid: "Fixe + commission",
  cpa_tiers: "Paliers de commission",
};

/**
 * Ce que le montant ACHÈTE, dit en clair sous le chiffre.
 *
 * ─── Le manque ───
 * La carte annonçait « 300 € par créateur ». Par créateur pour quoi ? Une
 * vidéo ? une story ? un contenu à réutiliser ? Un montant sans objet ne se
 * compare a rien, et un créateur ne peut pas décider s'il est bien payé sans
 * savoir ce qu'on lui demande.
 *
 * Le type de la campagne portait déjà l'information depuis le début ; la carte
 * ne s'en servait pas.
 */
export const OBJET_DU_MONTANT: Record<string, string> = {
  video: "pour une vidéo postée",
  ugc: "pour du contenu UGC",
  hybrid: "par vidéo",
  performance: "selon les résultats",
  cpa_flat: "par inscription",
  cpa_tiers: "selon les paliers",
};

/** Le libellé du montant fixe, avec un repli honnête quand le type est inconnu. */
export function objetDuMontant(type: string): string {
  return OBJET_DU_MONTANT[type] ?? "par créateur";
}
