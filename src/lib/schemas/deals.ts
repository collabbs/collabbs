import { z } from "zod";
import {
  nombreEntier,
  texteFacultatif,
  texteObligatoire,
  dateISO,
  TEXTE_COURT_MAX,
  TEXTE_LONG_MAX,
} from "@/lib/validation";

/**
 * Contrôles des termes d'une collaboration.
 *
 * Ce que ces contrôles remplacent, et pourquoi c'est mieux :
 *
 * `updateDealTerms` écrivait `Math.max(0, Math.round(data.amount))`. Trois
 * comportements silencieux là-dedans :
 *
 *  - **L'arrondi.** Le montant est un entier d'euros en base, c'est un choix
 *    assumé — mais une marque qui saisit 1 400,50 obtenait 1 400 SANS un mot.
 *    On modifiait ce qu'elle avait écrit, sur de l'argent. Mieux vaut le lui
 *    dire et la laisser trancher.
 *  - **Le plancher à zéro.** Un montant négatif devenait 0, c'est-à-dire une
 *    collaboration gratuite, au lieu d'être refusé.
 *  - **L'absence de plafond.** Rien n'empêchait un séquestre à neuf chiffres
 *    né d'une touche restée enfoncée.
 */

/**
 * Plafond d'une collaboration. Ce n'est pas une limite commerciale mais un
 * garde-fou contre la faute de frappe : au-delà, on préfère en parler plutôt
 * que d'ouvrir un séquestre de ce montant.
 */
export const DEAL_MONTANT_MAX = 200_000;

/** Nombre maximum de contenus pour une même collaboration. */
export const DEAL_QUANTITE_MAX = 100;

/**
 * Plafond de vues déclarables : 5 milliards, soit davantage que la vidéo la
 * plus vue de l'histoire. Ce n'est pas une limite commerciale — le plafond du
 * séquestre borne déjà la dépense — mais un garde-fou contre la touche restée
 * enfoncée, sur un champ qui se transforme en euros.
 */
export const VUES_MAX = 5_000_000_000;

/**
 * Déclaration de vues par le créateur.
 *
 * Le lien du contenu est EXIGÉ, et c'est délibéré : les vues ne sont pas
 * vérifiables automatiquement (il faudrait les comptes développeurs TikTok et
 * Instagram, qu'on n'a pas). La marque valide donc à la main, et elle ne peut
 * le faire que si elle peut aller voir. Une déclaration sans lien lui
 * demanderait de signer un chèque les yeux fermés.
 */
export const declarationVuesSchema = z.object({
  views: nombreEntier({
    quoi: "Le nombre de vues",
    min: 0,
    max: VUES_MAX,
  }),
  proofUrl: z
    .string()
    .trim()
    .min(1, { error: "Ajoute le lien de ton contenu publié : c'est ce que la marque va vérifier." })
    .refine((v) => /^https?:\/\/.+\..+/.test(v), {
      error: "Ce lien ne ressemble pas à une adresse valide. Copie-colle l'URL de ta publication.",
    }),
});

/**
 * Adresse de livraison du produit.
 *
 * C'est une donnée personnelle, et c'est le créateur qui la donne — jamais la
 * marque. Les champs exigés sont ceux sans lesquels un colis revient : un nom,
 * une rue, un code postal, une ville, un pays. Le téléphone reste facultatif
 * mais on le demande, parce que la plupart des transporteurs en ont besoin
 * pour livrer.
 */
export const adresseLivraisonSchema = z.object({
  name: texteObligatoire({ quoi: "Le nom du destinataire", max: TEXTE_COURT_MAX }),
  line1: texteObligatoire({ quoi: "L'adresse", max: TEXTE_COURT_MAX }),
  line2: texteFacultatif({ quoi: "Le complément d'adresse", max: TEXTE_COURT_MAX }).nullish(),
  zip: texteObligatoire({ quoi: "Le code postal", max: 16 }),
  city: texteObligatoire({ quoi: "La ville", max: TEXTE_COURT_MAX }),
  country: texteObligatoire({ quoi: "Le pays", max: TEXTE_COURT_MAX }),
  phone: texteFacultatif({ quoi: "Le téléphone", max: 32 }).nullish(),
  note: texteFacultatif({ quoi: "L'indication de livraison", max: TEXTE_LONG_MAX }).nullish(),
});

/**
 * Déclaration d'expédition par la marque.
 *
 * Transporteur et numéro de suivi sont FACULTATIFS : toutes les remises ne
 * passent pas par un transporteur suivi — main propre, coursier, produit
 * envoyé par un autre canal. Les rendre obligatoires forcerait la marque à
 * inventer un numéro, ce qui est pire que pas de numéro du tout.
 */
export const expeditionSchema = z
  .object({
    carrier: texteFacultatif({ quoi: "Le transporteur", max: TEXTE_COURT_MAX }).nullish(),
    tracking: texteFacultatif({ quoi: "Le numéro de suivi", max: TEXTE_COURT_MAX }).nullish(),
  })
  /**
   * Les deux sont facultatifs ENSEMBLE — expédier sans suivi est courant, et
   * le créateur voit alors simplement que le colis est parti.
   *
   * Mais un numéro SANS transporteur ne sert à rien : c'est de lui qu'on
   * déduit le lien de suivi. Sans lui, le créateur lit « Suivi : 6A12345678901 »
   * sans savoir chez qui le chercher — un numéro qu'on ne peut pas suivre
   * inquiète plus qu'il ne rassure.
   */
  .refine((v) => !v.tracking?.trim() || Boolean(v.carrier?.trim()), {
    path: ["carrier"],
    message:
      "Indique le transporteur : sans lui, le numéro de suivi n'ouvre aucun lien et le créateur ne peut rien en faire.",
  });

/**
 * Le format de la collaboration.
 *
 * Il était figé à « vidéo postée » pour toute proposition directe, et
 * modifiable nulle part ensuite : une marque qui commandait trois stories
 * signait un contrat qui annonçait une vidéo postée. Faux dans le document
 * qui fait foi, ce qui est le pire endroit pour se tromper.
 */
export const formatDealSchema = z.enum(["video_post", "ugc", "story", "reel", "live"], {
  message: "Choisis un format de contenu.",
});

export const modeleSchema = z.enum(["forfait", "performance", "produit"], {
  message: "Choisis comment le créateur est payé.",
});

export const termesDealSchema = z.object({
  format: formatDealSchema.nullish(),
  /** Comment le créateur est payé. Absent = on ne touche pas au modèle. */
  modele: modeleSchema.nullish(),
  /**
   * Tarif pour 1 000 vues, sur une collaboration à la performance.
   * En euros entiers : c'est ce que la colonne accepte, et un tarif au centime
   * près sur 1 000 vues n'a aucun sens pratique.
   */
  perfRate: nombreEntier({
    quoi: "Le tarif pour 1 000 vues",
    min: 1,
    max: 1000,
  }).nullish(),
  /**
   * En euros ENTIERS : la colonne l'est. On refuse la virgule au lieu de
   * l'arrondir en douce.
   */
  /**
   * Le minimum est ZÉRO et non un : un produit offert est une collaboration
   * sans argent, parfaitement valable. Le contrôle croisé plus bas refuse le
   * zéro sur les deux autres modèles — une collaboration en argent à 0 € est
   * une coquille vide que le créateur ne peut pas accepter.
   */
  amount: nombreEntier({
    quoi: "Le montant de la collaboration",
    min: 0,
    max: DEAL_MONTANT_MAX,
  }),
  quantity: nombreEntier({
    quoi: "Le nombre de contenus",
    min: 1,
    max: DEAL_QUANTITE_MAX,
  }),
  /** Une échéance passée n'est pas refusée : les parties peuvent régulariser. */
  deadline: dateISO("L'échéance").nullable(),
  /** Absent quand la marque n'a rien précisé : c'est un cas normal. */
  brandNotes: texteFacultatif({
    quoi: "Le brief",
    max: TEXTE_LONG_MAX,
  }).nullable(),

  /**
   * Durée pendant laquelle l'annonceur peut réutiliser le contenu sur ses
   * propres supports, en mois.
   *
   * Ces deux champs existaient en base et étaient lus par le générateur de
   * contrat — mais AUCUN écran ne permettait de les renseigner. Chaque contrat
   * signé disait donc « dans les limites convenues entre les Parties sur la
   * plateforme », alors que la plateforme n'offrait aucun endroit pour en
   * convenir. Une clause qui tournait à vide.
   */
  usageRightsMonths: nombreEntier({
    quoi: "La durée des droits d'utilisation",
    min: 1,
    max: 120,
  })
    .nullish()
    .transform((v) => v ?? null),

  /**
   * Exclusivité : le créateur s'interdit les marques concurrentes.
   *
   * Ces trois champs sont FACULTATIFS à l'envoi : un appelant qui ne touche
   * pas aux droits ne doit pas être obligé de les répéter. L'absence vaut
   * « pas d'exclusivité », jamais « exclusivité sans durée ».
   */
  exclusivity: z.boolean().nullish().transform((v) => v ?? false),
  exclusivityDays: nombreEntier({
    quoi: "La durée d'exclusivité",
    min: 1,
    max: 365,
  })
    .nullish()
    .transform((v) => v ?? null),

  /**
   * Périmètre de réutilisation cédé. Absent = aucune cession.
   *
   * Volontairement séparé de la durée : une durée sans périmètre ne dit pas
   * ce qui a été cédé, et c'est justement le point qui se plaide.
   */
  usageRightsScope: z
    .enum(["organic", "paid"])
    .nullish()
    .transform((v) => v ?? null),

  /**
   * Part de `amount` qui rémunère les droits.
   *
   * Bornée au montant lui-même : c'en est une part, pas un supplément à côté.
   * Sans cette borne, l'écran afficherait « contenu : −200 € ».
   */
  usageRightsFee: nombreEntier({
    quoi: "Le montant des droits d'usage",
    min: 0,
    max: DEAL_MONTANT_MAX,
  })
    .nullish()
    .transform((v) => v ?? null),

  /**
   * La marque envoie-t-elle un produit ? Repris de la campagne à la création,
   * mais modifiable ici : une collaboration directe peut parfaitement inclure
   * un envoi, et une campagne « produit physique » peut aboutir à une collab
   * qui n'en demande pas.
   */
  shippingRequired: z.boolean().nullish().transform((v) => v ?? false),
})
  .refine((d) => d.usageRightsFee === null || d.usageRightsFee <= d.amount, {
    error:
      "Les droits d'usage ne peuvent pas dépasser le montant de la collaboration : ils en sont une part.",
    path: ["usageRightsFee"],
  })
  // Une part de droits sans durée ni périmètre facturerait une cession que le
  // contrat n'écrirait nulle part.
  .refine((d) => !d.usageRightsFee || d.usageRightsScope !== null, {
    error:
      "Précise le périmètre des droits d'usage (supports propres ou publicité payante) avant de les facturer.",
    path: ["usageRightsScope"],
  })
  /* ─── Ce que chaque modèle exige ───────────────────────────────────────────
     `amount` ne veut pas dire la même chose selon le modèle : un montant, un
     plafond, ou la valeur d'un cadeau. Le contrôle est donc croisé, et il est
     ici plutôt que dans l'écran — un écran se contourne. */
  .refine((d) => d.modele !== "performance" || (d.perfRate ?? 0) > 0, {
    error: "Indique le tarif pour 1 000 vues.",
    path: ["perfRate"],
  })
  .refine((d) => d.modele === "produit" || d.amount > 0, {
    error:
      "Une collaboration payée doit avoir un montant. Choisis « Produit offert » si tu ne verses pas d'argent.",
    path: ["amount"],
  })
  // Le plafond protège la marque autant que le créateur : sans lui, une vidéo
  // virale se règle en milliers d'euros qu'elle n'a pas provisionnés.
  .refine((d) => d.modele !== "performance" || d.amount >= (d.perfRate ?? 0), {
    error:
      "Le plafond doit valoir au moins le tarif de 1 000 vues, sinon il est atteint avant la première vue.",
    path: ["amount"],
  })
  /* Un produit offert sans description est un piège : le créateur signe pour
     « un produit » et découvre ce qu'il reçoit à la livraison. C'est la seule
     contrepartie de son travail — elle doit être écrite au contrat. */
  .refine((d) => d.modele !== "produit" || Boolean(d.brandNotes?.trim()), {
    error:
      "Décris le produit offert : c'est la seule contrepartie du créateur, et elle doit figurer au contrat.",
    path: ["brandNotes"],
  });
