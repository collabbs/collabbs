import { describe, it, expect } from "vitest";
import { affiliateBreakdown, AFFILIATE_FEE_RATE, MIN_PAYOUT, VALIDATION_DAYS } from "@/lib/affiliate-billing";
import { eur, eurExact, dealBreakdown } from "@/lib/deal";

/**
 * Les calculs d'argent.
 *
 * Ce sont les fonctions dont une erreur silencieuse coûte de l'argent réel :
 * une commission mal arrondie, des frais prélevés du mauvais côté, un centime
 * perdu à chaque vente. Elles ont été vérifiées à la main le 29 août ; ces
 * tests sont là pour que la vérification survive au prochain changement.
 */

describe("commission d'affiliation", () => {
  it("le créateur touche exactement le taux annoncé, les frais s'ajoutent", () => {
    const b = affiliateBreakdown(9);
    expect(b.creatorAmount).toBe(9); // jamais amputé
    expect(b.platformFee).toBe(2.25); // 25 % EN PLUS
    expect(b.brandTotal).toBe(11.25); // ce que débourse la marque
  });

  it("arrondit au centime, jamais à l'euro", () => {
    // Le bug du 29 août : Math.round((49.99 * 5) / 100) donnait 2 au lieu de 2,50.
    const b = affiliateBreakdown(2.4995);
    expect(b.creatorAmount).toBe(2.5);
    expect(b.platformFee).toBe(0.63);
  });

  it("ne perd rien sur les décimales flottantes", () => {
    const b = affiliateBreakdown(7.19);
    // 7.19 * 0.25 = 1.7975 en flottant → doit tomber à 1,80 et non 1,79
    expect(b.platformFee).toBe(1.8);
    expect(b.brandTotal).toBe(8.99);
  });

  it("la somme des parts égale toujours ce que paie la marque", () => {
    for (const c of [0.01, 1, 3.33, 9.6, 18, 129.9, 450]) {
      const b = affiliateBreakdown(c);
      expect(b.creatorAmount + b.platformFee).toBeCloseTo(b.brandTotal, 2);
    }
  });

  it("traite zéro sans produire de valeur aberrante", () => {
    const b = affiliateBreakdown(0);
    expect(b).toEqual({ creatorAmount: 0, platformFee: 0, brandTotal: 0 });
  });

  it("les constantes du modèle sont celles décidées", () => {
    expect(AFFILIATE_FEE_RATE).toBe(0.25);
    expect(VALIDATION_DAYS).toBe(30);
    expect(MIN_PAYOUT).toBe(20);
  });
});

describe("commission sur les collaborations", () => {
  it("prélève la part plateforme et laisse le net au créateur", () => {
    const b = dealBreakdown(100);
    expect(b.gross).toBe(100);
    expect(b.fee + b.net).toBeCloseTo(b.gross, 2);
    expect(b.net).toBeLessThan(b.gross);
  });
});

describe("affichage des montants", () => {
  it("les montants financiers gardent toujours les centimes", () => {
    // Le 29 août, /billing affichait « 12€ » et « 562,5€ » à côté de « 274,46€ ».
    expect(eurExact(12)).toBe("12,00€");
    expect(eurExact(562.5)).toBe("562,50€");
    expect(eurExact(274.46)).toBe("274,46€");
  });

  it("les tarifs affichés restent lisibles sans décimales inutiles", () => {
    expect(eur(300)).toBe("300€");
  });
});
