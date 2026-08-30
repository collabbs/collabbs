import { describe, it, expect } from "vitest";
import {
  valeursCampagneSchema,
  grilleCommissionSchema,
} from "@/lib/schemas/campaigns";
import { valider } from "@/lib/validation";

/**
 * Aucune de ces valeurs n'était vérifiée : elles partaient du formulaire
 * directement en base.
 *
 * Le cas grave est le taux de commission. Une virgule mal placée donne 500 %,
 * soit 500 € de commission PLUS 125 € de frais sur une vente de 100 € —
 * réservés dès la première vente sur la provision de la marque. Elle s'en
 * apercevrait en voyant sa provision fondre.
 */

const rien = {
  fixedAmount: null, perfRate: null, cpaValuePerAction: null,
  minSubscribers: null, spots: null,
  promoDiscountPct: null, promoCommissionPct: null, promoMinPurchase: null,
  giveawayPrizeValue: null, giveawayWinnersCount: null,
};

describe("grille de commission d'affiliation", () => {
  const grille = { nano: 3, micro: 5, mid: 8, macro: 12 };

  it("accepte une grille normale", () => {
    expect(valider(grilleCommissionSchema, grille).ok).toBe(true);
  });

  it("refuse une commission au-delà de 100 % — la marque perdrait de l'argent à chaque vente", () => {
    const r = valider(grilleCommissionSchema, { ...grille, macro: 500 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("macro");
  });

  it("refuse une commission négative", () => {
    expect(valider(grilleCommissionSchema, { ...grille, nano: -5 }).ok).toBe(false);
  });

  it("n'impose PAS que les paliers soient croissants", () => {
    // Mieux rémunérer un petit compte très engagé qu'un gros compte tiède est
    // une stratégie, pas une erreur.
    expect(valider(grilleCommissionSchema, { nano: 20, micro: 10, mid: 8, macro: 5 }).ok).toBe(true);
  });
});

describe("valeurs d'une campagne", () => {
  it("accepte une campagne sans aucune option activée", () => {
    expect(valider(valeursCampagneSchema, rien).ok).toBe(true);
  });

  it("refuse une remise de code promo au-delà de 100 %", () => {
    // Au-delà, on paierait le client pour qu'il commande.
    expect(valider(valeursCampagneSchema, { ...rien, promoDiscountPct: 150 }).ok).toBe(false);
    expect(valider(valeursCampagneSchema, { ...rien, promoDiscountPct: 100 }).ok).toBe(true);
  });

  it("refuse une commission sur code promo hors bornes", () => {
    expect(valider(valeursCampagneSchema, { ...rien, promoCommissionPct: 400 }).ok).toBe(false);
  });

  it("refuse un montant fixe négatif", () => {
    expect(valider(valeursCampagneSchema, { ...rien, fixedAmount: -300 }).ok).toBe(false);
  });

  it("borne la rémunération à la performance", () => {
    expect(valider(valeursCampagneSchema, { ...rien, perfRate: 5 }).ok).toBe(true);
    expect(valider(valeursCampagneSchema, { ...rien, perfRate: 50_000 }).ok).toBe(false);
  });

  it("accepte un montant par action au centime", () => {
    // Une inscription peut valoir 0,50 € : surtout ne pas arrondir à l'euro.
    expect(valider(valeursCampagneSchema, { ...rien, cpaValuePerAction: 0.5 }).ok).toBe(true);
    expect(valider(valeursCampagneSchema, { ...rien, cpaValuePerAction: 1.234 }).ok).toBe(false);
  });

  it("exige au moins une place et au moins un gagnant", () => {
    expect(valider(valeursCampagneSchema, { ...rien, spots: 0 }).ok).toBe(false);
    expect(valider(valeursCampagneSchema, { ...rien, giveawayWinnersCount: 0 }).ok).toBe(false);
    expect(valider(valeursCampagneSchema, { ...rien, spots: 1, giveawayWinnersCount: 1 }).ok).toBe(true);
  });

  it("accepte une audience minimale à zéro : ouvert à tous", () => {
    expect(valider(valeursCampagneSchema, { ...rien, minSubscribers: 0 }).ok).toBe(true);
  });

  it("ne laisse pas passer un message technique", () => {
    const r = valider(valeursCampagneSchema, { ...rien, promoDiscountPct: 150 });
    if (!r.ok) {
      expect(r.error).not.toContain("Expected");
      expect(r.error).not.toContain("Invalid");
    }
  });
});
