/**
 * Ce qui fait qu'un créateur apparaît devant les marques.
 *
 * ─── Pourquoi cette règle vit dans un seul fichier ───
 * Elle existait en DEUX exemplaires, et les deux ne disaient pas la même
 * chose. Le catalogue exigeait cinq choses — pseudo, photo, plateforme,
 * niche, offre — pendant que le tableau de bord n'en vérifiait que trois pour
 * décider s'il fallait alerter le créateur : il ignorait le pseudo et la
 * plateforme.
 *
 * Conséquence : un créateur sans pseudo voyait son tableau de bord silencieux
 * — donc « tout va bien » — et n'apparaissait dans aucune recherche de marque.
 * Invisible, sans le savoir, indéfiniment. Personne ne signale jamais ce
 * défaut, puisque rien n'a l'air cassé.
 *
 * Une seule fonction, deux appelants. Et elle rend ce qui MANQUE, pas un
 * booléen : « complète ton profil » n'aide personne qui croit l'avoir fait.
 */

export type EtatProfil = {
  pseudo: boolean;
  photo: boolean;
  plateforme: boolean;
  niche: boolean;
  offre: boolean;
};

/** Ce qu'il manque, nommé comme le créateur le voit dans son profil. */
const LIBELLES: Record<keyof EtatProfil, string> = {
  pseudo: "ton pseudo",
  photo: "ta photo",
  plateforme: "au moins un réseau",
  niche: "au moins une thématique",
  offre: "au moins une prestation",
};

/**
 * Le poids de chaque élément dans le pourcentage affiché.
 *
 * La photo pèse le plus parce que c'est elle qui fait s'arrêter une marque sur
 * une carte. Le total fait 100.
 */
const POIDS: Record<keyof EtatProfil, number> = {
  photo: 25,
  pseudo: 15,
  plateforme: 20,
  niche: 20,
  offre: 20,
};

export function profilVisible(e: EtatProfil): boolean {
  return e.pseudo && e.photo && e.plateforme && e.niche && e.offre;
}

/** Les éléments manquants, dans l'ordre où on conseille de les remplir. */
export function manquantsProfil(e: EtatProfil): string[] {
  return (["photo", "pseudo", "niche", "plateforme", "offre"] as const)
    .filter((cle) => !e[cle])
    .map((cle) => LIBELLES[cle]);
}

export function completionProfil(e: EtatProfil): number {
  return (Object.keys(POIDS) as (keyof EtatProfil)[])
    .reduce((somme, cle) => somme + (e[cle] ? POIDS[cle] : 0), 0);
}

/** « ta photo et ton pseudo », « ta photo, ton pseudo et une niche ». */
export function phraseManquants(manquants: string[]): string {
  if (manquants.length === 0) return "";
  if (manquants.length === 1) return manquants[0];
  return `${manquants.slice(0, -1).join(", ")} et ${manquants[manquants.length - 1]}`;
}
