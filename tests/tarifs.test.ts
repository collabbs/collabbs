import { describe, it, expect } from "vitest";
import { TARIFS, planValide, tauxCollab, tauxAffiliation } from "@/lib/tarifs";

describe("grille tarifaire", () => {
  it("un plan inconnu vaut gratuit, jamais un tarif avantageux", () => {
    // Colonne absente, valeur héritée, marque créée avant les abonnements :
    // aucun de ces cas ne doit offrir le tarif Scale par accident.
    for (const valeur of [null, undefined, "", "premium", "SCALE", "gratuit"]) {
      expect(planValide(valeur)).toBe("free");
      expect(tauxCollab(valeur)).toBe(0.1);
      expect(tauxAffiliation(valeur)).toBe(0.2);
    }
  });

  it("le taux baisse quand le plan monte — c'est ce que l'abonnement achète", () => {
    expect(TARIFS.free.tauxCollab).toBeGreaterThan(TARIFS.growth.tauxCollab);
    expect(TARIFS.growth.tauxCollab).toBeGreaterThan(TARIFS.scale.tauxCollab);
    expect(TARIFS.free.tauxAffiliation).toBeGreaterThan(TARIFS.growth.tauxAffiliation);
    expect(TARIFS.growth.tauxAffiliation).toBeGreaterThan(TARIFS.scale.tauxAffiliation);
  });

  it("l'abonnement se rembourse à un volume atteignable", () => {
    // Growth coûte 99 € et fait gagner 2 points sur les collaborations :
    // il est rentable à partir de 4 950 € de collaborations par mois.
    const economie = TARIFS.free.tauxCollab - TARIFS.growth.tauxCollab;
    expect(Math.round(TARIFS.growth.prix / economie)).toBe(4950);
  });
});
