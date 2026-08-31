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
  /**
   * Depuis la loi du 14 février 2022, un entrepreneur individuel doit faire
   * figurer la mention « EI » ou « entrepreneur individuel » à côté de son nom
   * sur ses documents commerciaux.
   */
  name: "Julien DRENEAU — Entrepreneur individuel (EI)",
  legalForm: "Entreprise individuelle, régime de la micro-entreprise",
  /** Sans objet : une entreprise individuelle n'a pas de capital social. */
  capital: "Sans objet",
  address: "3 impasse de Bourgogne",
  zip: "37390",
  city: "Chanceaux-sur-Choisille",
  country: "France",
  siret: "947 466 918 00010",
  /**
   * Immatriculation, vérifiée le 31/08/2026 sur le registre public
   * (`recherche-entreprises.api.gouv.fr`, SIREN 947466918).
   *
   * Le champ s'appelait « RCS » et portait un numéro DÉDUIT du greffe de Tours,
   * jamais lu dans un document officiel. Or le registre public ne publie aucun
   * numéro RCS pour cette entreprise, et c'est normal : depuis le 1er janvier
   * 2023, le registre du commerce et le répertoire des métiers ont fusionné
   * dans le **Registre National des Entreprises** pour les entrepreneurs
   * individuels. La mention exacte est donc le RNE, avec le SIREN — et le
   * registre confirme l'inscription (dernière mise à jour RNE : 15/07/2026).
   *
   * Inventer un « RCS Tours 947 466 918 » aurait produit une mention légale
   * fausse, ce que ces pages sont précisément censées empêcher.
   */
  registration: "Immatriculée au Registre National des Entreprises (RNE) — SIREN 947 466 918",
  vat: "FR66947466918",
  publicationDirector: "Julien Dreneau",
  contactEmail: "contact@collabbs.com",
  /** ⚠️ À COMPLÉTER — un moyen de contact direct est exigé par la LCEN. */
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
