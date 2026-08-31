import { describe, it, expect } from "vitest";
import {
  depenseDIndifference,
  planLePlusEconomique,
  fenetreDOptimalite,
  TARIFS,
} from "@/lib/tarifs";

/**
 * Ces tests ne vérifient pas un comportement du produit : ils CONSTATENT ce que
 * la grille tarifaire fait réellement à une marque qui compare.
 *
 * Ils sont écrits parce qu'une grille peut être arithmétiquement absurde sans
 * que ça se voie, et parce que le jour où la grille changera, il faudra
 * pouvoir vérifier que la nouvelle tient debout. Un test qui échoue ici après
 * une modification de prix n'est pas une régression logicielle — c'est une
 * question à se poser.
 */

describe("points d'indifférence entre plans", () => {
  it("gratuit et growth se rejoignent à 4 950 € de dépense mensuelle", () => {
    expect(depenseDIndifference("free", "growth")).toBe(4950);
  });

  it("growth et scale se rejoignent à 6 667 €", () => {
    expect(depenseDIndifference("growth", "scale")).toBe(6667);
  });

  it("gratuit et scale se rejoignent à 5 980 €", () => {
    expect(depenseDIndifference("free", "scale")).toBe(5980);
  });

  it("deux plans de même taux n'ont pas de croisement", () => {
    expect(depenseDIndifference("free", "free")).toBeNull();
  });
});

describe("quel plan une marque a-t-elle intérêt à prendre", () => {
  it("en dessous de 4 950 €, le gratuit est le moins cher", () => {
    for (const d of [0, 350, 1000, 2000, 3500, 4900]) {
      expect(planLePlusEconomique(d)).toBe("free");
    }
  });

  it("au-delà de 6 667 €, scale est le moins cher", () => {
    for (const d of [7000, 10000, 25000]) {
      expect(planLePlusEconomique(d)).toBe("scale");
    }
  });
});

describe("CONSTAT — le plan Growth est économiquement dominé", () => {
  it("Growth n'est le moins cher que sur une fenêtre de 1 717 €", () => {
    const f = fenetreDOptimalite("growth");
    expect(f).not.toBeNull();
    expect(f!.debut).toBeGreaterThanOrEqual(4950);
    expect(f!.fin).toBeLessThanOrEqual(6675);
    expect(f!.fin! - f!.debut).toBeLessThan(1800);
  });

  it("cette fenêtre correspond à 14 à 19 collaborations par mois à 350 €", () => {
    const f = fenetreDOptimalite("growth")!;
    expect(Math.round(f.debut / 350)).toBe(14);
    expect(Math.round(f.fin! / 350)).toBe(19);
  });

  it("une marque qui fait 4 collaborations par mois n'a aucun intérêt à s'abonner", () => {
    // 4 × 350 € = 1 400 € de dépense mensuelle. C'est une marque active et
    // normale — le cœur de cible. Elle paierait 140 € en gratuit, 211 € en
    // Growth, 369 € en Scale. L'abonnement lui coûte 50 % de plus.
    const depense = 4 * 350;
    expect(planLePlusEconomique(depense)).toBe("free");
    const gratuit = TARIFS.free.prix + TARIFS.free.tauxCollab * depense;
    const growth = TARIFS.growth.prix + TARIFS.growth.tauxCollab * depense;
    expect(growth).toBeGreaterThan(gratuit * 1.4);
  });

  it("le seul moteur d'abonnement est donc le plafond de campagnes, pas le prix", () => {
    // Constat, pas préférence : sur toute la plage réaliste du marché visé
    // (jusqu'à 10 collaborations par mois), le gratuit gagne toujours.
    for (let collabs = 1; collabs <= 10; collabs++) {
      expect(planLePlusEconomique(collabs * 350)).toBe("free");
    }
    expect(TARIFS.free.campagnesActives).not.toBeNull();
  });
});
