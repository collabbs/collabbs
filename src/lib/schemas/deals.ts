import { z } from "zod";
import {
  nombreEntier,
  texteFacultatif,
  dateISO,
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

export const termesDealSchema = z.object({
  /**
   * En euros ENTIERS : la colonne l'est. On refuse la virgule au lieu de
   * l'arrondir en douce.
   */
  amount: nombreEntier({
    quoi: "Le montant de la collaboration",
    min: 1,
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
});
