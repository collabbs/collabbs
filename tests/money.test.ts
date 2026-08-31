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
    expect(b.platformFee).toBe(1.8); // 20 % EN PLUS
    expect(b.brandTotal).toBe(10.8); // ce que débourse la marque
  });

  it("arrondit au centime, jamais à l'euro", () => {
    // Le bug du 29 août : Math.round((49.99 * 5) / 100) donnait 2 au lieu de 2,50.
    const b = affiliateBreakdown(2.4995);
    expect(b.creatorAmount).toBe(2.5);
    expect(b.platformFee).toBe(0.5);
  });

  it("ne perd rien sur les décimales flottantes", () => {
    const b = affiliateBreakdown(7.19);
    // 7.19 * 0.2 = 1.4380000000000002 en flottant → doit tomber à 1,44
    expect(b.platformFee).toBe(1.44);
    expect(b.brandTotal).toBe(8.63);
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
    expect(AFFILIATE_FEE_RATE).toBe(0.2);
    expect(VALIDATION_DAYS).toBe(30);
    expect(MIN_PAYOUT).toBe(20);
  });
});

describe("commission sur les collaborations", () => {
  it("le créateur touche le montant convenu, entier", () => {
    // C'est le cœur de la promesse : « 0 % prélevé au créateur ». Elle était
    // fausse tant que la commission était déduite de sa part — il recevait
    // 270 € sur une collaboration annoncée à 300 €.
    const b = dealBreakdown(100);
    expect(b.net).toBe(100);
  });

  it("la commission s'ajoute, et c'est la marque qui la règle", () => {
    const b = dealBreakdown(100);
    expect(b.fee).toBe(10);
    expect(b.gross).toBe(110);
    expect(b.gross).toBe(b.net + b.fee);
  });

  it("le taux suit le plan de la marque — c'est ce que l'abonnement achète", () => {
    expect(dealBreakdown(1000, "free").fee).toBe(100);
    expect(dealBreakdown(1000, "growth").fee).toBe(80);
    expect(dealBreakdown(1000, "scale").fee).toBe(50);
    // Un plan inconnu ne donne jamais le tarif avantageux par accident.
    expect(dealBreakdown(1000, "premium").fee).toBe(100);
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
