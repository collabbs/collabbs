/**
 * Identité juridique de l'éditeur du site.
 *
 * ⚠️ À COMPLÉTER AVANT TOUTE OUVERTURE AU PUBLIC.
 * Les mentions légales sont obligatoires (article 6 de la LCEN du 21 juin
 * 2004) et l'absence ou l'inexactitude de ces informations est sanctionnée.
 * Les valeurs marquées À_COMPLÉTER s'affichent en évidence sur la page tant
 * qu'elles ne sont pas remplies — c'est délibéré : mieux vaut un trou visible
 * qu'une mention fausse.
 *
 * Un seul endroit à modifier : toutes les pages légales lisent d'ici.
 */

export const TODO = "À_COMPLÉTER" as const;

export const LEGAL_ENTITY = {
  /** Dénomination sociale, ou nom et prénom si entreprise individuelle. */
  name: TODO,
  /** Forme juridique : SASU, SARL, entreprise individuelle, micro-entreprise… */
  legalForm: TODO,
  /** Capital social, le cas échéant. Laisser TODO si entreprise individuelle. */
  capital: TODO,
  /** Adresse du siège social. */
  address: TODO,
  zip: TODO,
  city: TODO,
  country: "France",
  /** SIREN ou SIRET. */
  siret: TODO,
  /** Ville du greffe + numéro RCS, si société. */
  rcs: TODO,
  /** TVA intracommunautaire, si assujetti. */
  vat: TODO,
  /** Personne physique responsable du contenu publié. */
  publicationDirector: TODO,
  /** Adresse de contact affichée publiquement. */
  contactEmail: "contact@collabbs.com",
  /** Téléphone. Facultatif, mais un moyen de contact direct est exigé. */
  phone: TODO,
} as const;

/** Hébergeur — obligatoire dans les mentions légales. */
export const HOST = {
  name: "Vercel Inc.",
  address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
  website: "https://vercel.com",
} as const;

/** Sous-traitants qui traitent des données personnelles pour Collabbs. */
export const PROCESSORS = [
  {
    name: "Vercel Inc.",
    role: "Hébergement du site et des fonctions serveur",
    location: "États-Unis, avec exécution en région Europe (Francfort)",
  },
  {
    name: "Supabase Inc.",
    role: "Base de données, authentification et stockage de fichiers",
    location: "Union européenne (Francfort, Allemagne)",
  },
  {
    name: "Stripe Payments Europe, Ltd.",
    role: "Paiements, séquestre des fonds et versements aux créateurs",
    location: "Irlande",
  },
  {
    name: "Resend",
    role: "Envoi des e-mails transactionnels",
    location: "Union européenne (Irlande)",
  },
  {
    name: "Google LLC (YouTube Data API)",
    role: "Vérification d'audience et import de contenus publics, à la demande du créateur",
    location: "États-Unis",
  },
] as const;

export const SITE = {
  name: "Collabbs",
  url: "https://collabbs.com",
  /** Date de dernière mise à jour des documents légaux. */
  updatedAt: "29 août 2026",
} as const;

/** Vrai si l'identité de l'éditeur n'est pas encore renseignée. */
export function legalEntityIncomplete(): boolean {
  return Object.values(LEGAL_ENTITY).some((v) => v === TODO);
}
