import { describe, it, expect } from "vitest";
import {
  commissionDueSurCePaiement,
  estUnRenouvellement,
  gainTotalAnnonce,
  RYTHMES_COMMISSION,
  TOUS_LES_PAIEMENTS,
} from "@/lib/commission-recurrente";

describe("combien de fois un abonnement rapporte", () => {
  it("le réglage par défaut ne paie que le premier paiement", () => {
    expect(commissionDueSurCePaiement(1, 0)).toBe(true);
    expect(commissionDueSurCePaiement(1, 1)).toBe(false);
    expect(commissionDueSurCePaiement(1, 5)).toBe(false);
  });

  it("douze mois paient douze fois, pas treize", () => {
    expect(commissionDueSurCePaiement(12, 11)).toBe(true);
    expect(commissionDueSurCePaiement(12, 12)).toBe(false);
  });

  it("« à vie » paie toujours", () => {
    for (const deja of [0, 1, 50, 500]) {
      expect(commissionDueSurCePaiement(TOUS_LES_PAIEMENTS, deja)).toBe(true);
    }
  });

  it("une valeur absurde retombe sur le réglage le plus prudent", () => {
    // Une commission infinie par accident coûterait de l'argent réel à la
    // marque, tous les mois, sans que personne l'ait décidé.
    for (const absurde of [-3, NaN, Infinity]) {
      expect(commissionDueSurCePaiement(absurde, 0)).toBe(true);
      expect(commissionDueSurCePaiement(absurde, 1)).toBe(false);
    }
  });

  it("une vente sans abonnement passe toujours", () => {
    // L'e-commerce ordinaire : un paiement, aucun historique derrière.
    expect(commissionDueSurCePaiement(1, 0)).toBe(true);
  });
});

describe("la fenêtre d'attribution et les renouvellements", () => {
  it("un renouvellement échappe à la fenêtre", () => {
    // Sinon la marque recevrait chaque mois une vente à trancher à la main,
    // sur une commission parfaitement due — et finirait par ne plus regarder.
    expect(estUnRenouvellement("sub_123", 1)).toBe(true);
    expect(estUnRenouvellement("sub_123", 7)).toBe(true);
  });

  it("le premier paiement d'un abonnement y est soumis", () => {
    expect(estUnRenouvellement("sub_123", 0)).toBe(false);
  });

  it("une vente e-commerce y est soumise", () => {
    expect(estUnRenouvellement(null, 0)).toBe(false);
  });
});

describe("ce qu'on annonce au créateur", () => {
  it("douze mois à 20 % sur 29 € font bien 69,60 €", () => {
    // Le chiffre qui décide un créateur à accepter. 5,80 € une fois ne
    // déplace personne.
    const { parPaiement, total } = gainTotalAnnonce(29, 20, 12);
    expect(parPaiement).toBe(5.8);
    expect(total).toBe(69.6);
  });

  it("« à vie » n'annonce aucun total", () => {
    // Promettre un total reviendrait à promettre une durée d'abonnement que
    // personne ne connaît.
    expect(gainTotalAnnonce(29, 20, TOUS_LES_PAIEMENTS).total).toBeNull();
  });

  it("le taux est un pourcentage, jamais une fraction", () => {
    // 20 et 0,2 donnent des montants cent fois différents. Le test fige la
    // convention de la base : les colonnes commission_* portent 20 pour 20 %.
    expect(gainTotalAnnonce(100, 10, 1).parPaiement).toBe(10);
    expect(gainTotalAnnonce(100, 0.1, 1).parPaiement).not.toBe(10);
  });

  it("les rythmes proposés sont distincts et incluent le défaut", () => {
    const valeurs = RYTHMES_COMMISSION.map((r) => r.valeur);
    expect(new Set(valeurs).size).toBe(valeurs.length);
    expect(valeurs).toContain(1);
    expect(valeurs).toContain(TOUS_LES_PAIEMENTS);
  });
});
