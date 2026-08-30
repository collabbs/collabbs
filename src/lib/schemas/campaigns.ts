import { z } from "zod";
import {
  montantEuros,
  pourcentage,
  nombreEntier,
} from "@/lib/validation";

/**
 * Contrôles des valeurs chiffrées d'une campagne.
 *
 * Aucune de ces valeurs n'était vérifiée : elles partaient du formulaire
 * directement en base. Ce n'est pas une question de propreté, c'est une
 * question d'argent.
 *
 * **Le cas le plus grave, les taux de commission.** Rien ne les plafonnait.
 * Une commission saisie à 500 % — une virgule mal placée suffit — coûte à la
 * marque 500 € de commission sur une vente de 100 €, PLUS les frais de
 * plateforme qui s'ajoutent par-dessus : 625 € prélevés sur sa provision pour
 * une vente de 100 €. Et comme la commission est réservée dès la vente, elle
 * s'en apercevrait en voyant sa provision fondre.
 *
 * **La remise d'un code promo** au-delà de 100 % voudrait dire qu'on paie le
 * client pour qu'il commande.
 *
 * Ces contrôles ne remplacent pas le jugement de la marque : ils écartent
 * l'absurde, pas l'imprudent. Une commission à 90 % reste possible — c'est son
 * argent et sa décision.
 */

/** Rémunération d'une campagne à la performance, pour 1 000 vues. */
export const PERF_RATE_MAX = 1_000;

/** Montant fixe d'une campagne payée au contenu. */
export const FIXED_AMOUNT_MAX = 200_000;

/** Valeur d'une action au CPA. */
export const CPA_VALEUR_MAX = 10_000;

/** Un montant facultatif : absent quand l'option n'est pas activée. */
const montantFacultatif = (quoi: string, max: number) =>
  montantEuros({ quoi, min: 0, max }).nullable();

const pourcentageFacultatif = (quoi: string) => pourcentage(quoi).nullable();

/**
 * Les quatre paliers de commission d'affiliation, par taille d'audience.
 *
 * Ils ne sont PAS contraints à être croissants : une marque peut vouloir
 * rémunérer davantage un petit compte très engagé qu'un gros compte tiède.
 * C'est une stratégie, pas une erreur.
 */
export const grilleCommissionSchema = z.object({
  nano: pourcentage("La commission des nano-créateurs"),
  micro: pourcentage("La commission des micro-créateurs"),
  mid: pourcentage("La commission des créateurs intermédiaires"),
  macro: pourcentage("La commission des macro-créateurs"),
});

export const valeursCampagneSchema = z.object({
  fixedAmount: montantFacultatif("Le montant fixe", FIXED_AMOUNT_MAX),
  perfRate: montantFacultatif("La rémunération pour 1 000 vues", PERF_RATE_MAX),
  cpaValuePerAction: montantFacultatif("Le montant par action", CPA_VALEUR_MAX),

  /** Audience minimale exigée. Zéro veut dire « ouvert à tous ». */
  minSubscribers: nombreEntier({
    quoi: "L'audience minimale",
    min: 0,
    max: 500_000_000,
  }).nullable(),
  /** Nombre de places. Une campagne sans limite laisse ce champ vide. */
  spots: nombreEntier({ quoi: "Le nombre de places", min: 1, max: 10_000 }).nullable(),

  promoDiscountPct: pourcentageFacultatif("La remise du code promo"),
  promoCommissionPct: pourcentageFacultatif("La commission sur code promo"),
  promoMinPurchase: montantFacultatif("Le panier minimum", FIXED_AMOUNT_MAX),

  giveawayPrizeValue: montantFacultatif("La valeur du lot", FIXED_AMOUNT_MAX),
  giveawayWinnersCount: nombreEntier({
    quoi: "Le nombre de gagnants",
    min: 1,
    max: 10_000,
  }).nullable(),
});
