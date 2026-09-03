/**
 * Un profil créateur est-il complet au point d'être montré aux marques ?
 *
 * Cette règle existait en TROIS exemplaires qui ne disaient pas la même chose :
 *
 *  - le catalogue (`getMarketplaceCreators`) exigeait pseudo + photo + réseau
 *    + niche + offre ;
 *  - le wizard d'inscription affichait « ✓ Visible par les marques » dès que
 *    photo + niche + offre étaient là — sans le réseau. Il promettait donc une
 *    visibilité que le catalogue refusait ensuite, en silence ;
 *  - la candidature à une campagne n'exigeait, elle, rien du tout.
 *
 * D'où une seule fonction, pure, importable côté client comme côté serveur.
 * Elle rend la liste de ce qui manque, pour qu'on puisse le DIRE plutôt que de
 * se contenter de refuser.
 */
export type ProfilACompleter = {
  pseudo?: string | null;
  photo?: string | null;
  reseaux: number;
  niches: number;
  offres: number;
};

export type Listabilite = {
  listable: boolean;
  /** Ce qui manque, en clair, dans l'ordre où le wizard le demande. */
  manquants: string[];
};

export function evaluerProfil(p: ProfilACompleter): Listabilite {
  const manquants: string[] = [];
  if (!p.pseudo || !p.pseudo.trim()) manquants.push("un pseudo");
  if (!p.photo) manquants.push("une photo");
  if (p.niches <= 0) manquants.push("au moins une niche");
  if (p.reseaux <= 0) manquants.push("au moins un réseau");
  if (p.offres <= 0) manquants.push("au moins une offre");
  return { listable: manquants.length === 0, manquants };
}

/** Phrase prête à afficher : « Il te manque une photo et au moins une offre. » */
export function phraseManquants(manquants: string[]): string {
  if (manquants.length === 0) return "";
  if (manquants.length === 1) return `Il te manque ${manquants[0]}.`;
  const debut = manquants.slice(0, -1).join(", ");
  return `Il te manque ${debut} et ${manquants[manquants.length - 1]}.`;
}
