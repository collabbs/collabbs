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
    href: "/outils/seuil-1000-euros",
    titre: "Suivi du seuil de 1 000 €",
    resume:
      "Depuis janvier 2026, le contrat écrit est obligatoire dès 1 000 € HT cumulés dans l'année avec une même marque, produits offerts compris. Suivez votre cumul marque par marque — rien ne quitte votre navigateur.",
    pour: "Créateurs",
  },
  {
    href: "/outils/modele-contrat",
    titre: "Modèle de contrat conforme au décret",
    resume:
      "Le décret impose le contrat écrit au-delà de 1 000 €, mais n'impose à personne de le fournir. Voici le document, avec toutes les mentions obligatoires — à copier, compléter et imprimer.",
    pour: "Créateurs et marques",
  },
  {
    href: "/outils/droits-usage",
    titre: "Calculateur de droits d'usage",
    resume:
      "Payer une vidéo ne donne pas le droit de l'exploiter indéfiniment. Chiffrez ce que vaut la cession selon la durée et le périmètre, avec les paliers réellement pratiqués par le marché.",
    pour: "Créateurs et marques",
  },
];
