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
  }).nullable(),

  /** Exclusivité : le créateur s'interdit les marques concurrentes. */
  exclusivity: z.boolean(),
  exclusivityDays: nombreEntier({
    quoi: "La durée d'exclusivité",
    min: 1,
    max: 365,
  }).nullable(),
});
