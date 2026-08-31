import { z } from "zod";
import { nombreEntier } from "@/lib/validation";
import { DEAL_MONTANT_MAX, DEAL_QUANTITE_MAX } from "@/lib/schemas/deals";

/**
 * Contrôles d'un partenariat récurrent.
 *
 * Les bornes ne sont pas cosmétiques : chaque valeur ici sera multipliée par le
 * nombre de mois et deviendra une suite de séquestres réels. Une faute de
 * frappe sur le montant mensuel ne coûte pas une fois le montant, elle le coûte
 * douze fois.
 */
export const engagementSchema = z.object({
  /**
   * Durée en mois. Trois au minimum — en dessous, ce n'est pas un partenariat,
   * c'est une collaboration qu'on peut simplement reconduire à la main. Trente-
   * six au plus : au-delà, la borne protège d'une saisie aberrante, pas d'une
   * volonté.
   */
  months: nombreEntier({ quoi: "La durée du partenariat", min: 3, max: 36 }),
  contentsPerMonth: nombreEntier({
    quoi: "Le nombre de contenus par mois",
    min: 1,
    max: DEAL_QUANTITE_MAX,
  }),
  /**
   * Montant versé chaque mois au créateur. Au moins 1 € : un partenariat à 0 €
   * ouvrirait douze collaborations gratuites que le créateur ne pourrait même
   * pas accepter, puisqu'accepter à 0 € est déjà refusé ailleurs.
   */
  monthlyAmount: nombreEntier({
    quoi: "Le montant mensuel",
    min: 1,
    max: DEAL_MONTANT_MAX,
  }),
});
