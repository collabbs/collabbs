/**
 * Les outils publics.
 *
 * Une liste, pas une page : le sommaire, le plan du site et le `llms.txt` la
 * lisent tous les trois. Recopier trois fois la même chose garantit qu'un jour
 * l'une des trois mentira.
 */
export type Outil = {
  href: string;
  titre: string;
  resume: string;
  /** À qui il sert d'abord. Sert d'intitulé de rubrique. */
  pour: string;
};

export const OUTILS: Outil[] = [
  {
    href: "/outils/droits-usage",
    titre: "Calculateur de droits d'usage",
    resume:
      "Payer une vidéo ne donne pas le droit de l'exploiter indéfiniment. Chiffrez ce que vaut la cession selon la durée et le périmètre, avec les paliers réellement pratiqués par le marché.",
    pour: "Créateurs et marques",
  },
];
