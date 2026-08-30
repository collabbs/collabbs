/**
 * Ce qu'on accepte en entrée des actions de provision.
 *
 * C'est l'endroit du produit où une marque met de l'argent sur la table. Les
 * montants partent directement dans une session Stripe (`unit_amount`), et le
 * seuil de recharge automatique décide, tout seul et sans personne devant
 * l'écran, de repasser la carte de la marque. Une valeur absurde ici ne fait
 * pas planter une page : elle prélève.
 */

import { z } from "zod";
import { identifiant, montantEuros } from "@/lib/validation";

/**
 * Minimum d'approvisionnement, en euros.
 *
 * Repris tel quel de `createTopupCheckout` : cette valeur est annoncée sur la
 * page de facturation (« Minimum 20 € »), et deux endroits qui la connaissent
 * finiraient par ne plus être d'accord.
 */
export const TOPUP_MIN_EUROS = 20;

/**
 * Plafond d'un approvisionnement manuel.
 *
 * Une marque qui veut déposer plus passera plusieurs fois, ou nous écrira. La
 * faute de frappe à un zéro près, elle, est beaucoup plus fréquente qu'un dépôt
 * de 200 000 €.
 */
export const TOPUP_MAX_EUROS = 100_000;

/** Approvisionnement manuel de la provision. */
export const approvisionnementSchema = z.object({
  amount: montantEuros({
    quoi: "Le montant à approvisionner",
    min: TOPUP_MIN_EUROS,
    max: TOPUP_MAX_EUROS,
    messageMin: `Le montant minimum d'approvisionnement est de ${TOPUP_MIN_EUROS} €. Saisis 20 ou plus.`,
  }),
});

/**
 * Réglage de la recharge automatique.
 *
 * Ce schéma n'est appliqué QUE lorsque la recharge est activée — c'est déjà ce
 * que faisait le code, et pour une bonne raison : quand la case est décochée,
 * le formulaire désactive les deux champs, qui n'arrivent donc pas jusqu'ici.
 * Exiger un montant valable dans ce cas empêcherait simplement de désactiver
 * la recharge automatique.
 */
export const rechargeAutoSchema = z.object({
  /**
   * Solde en dessous duquel on recharge. Zéro est un réglage légitime : « ne
   * recharge que quand la provision est vide ».
   */
  threshold: montantEuros({
    quoi: "Le seuil de déclenchement",
    min: 0,
    max: TOPUP_MAX_EUROS,
  }),
  amount: montantEuros({
    quoi: "Le montant de recharge",
    min: TOPUP_MIN_EUROS,
    max: TOPUP_MAX_EUROS,
    messageMin: `Le montant de recharge doit faire au moins ${TOPUP_MIN_EUROS} €. Saisis 20 ou plus.`,
  }),
});

/**
 * Désignation d'une vente affiliée à trancher (rembourser, confirmer, refuser).
 *
 * Seul l'identifiant est fourni par le navigateur : le montant, lui, est relu
 * en base. C'est volontaire et il faut que ça le reste — un montant qui vient
 * du client est un montant que le client choisit.
 */
export const venteVisee = identifiant("Cette vente");
