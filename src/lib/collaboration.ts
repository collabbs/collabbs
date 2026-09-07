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
