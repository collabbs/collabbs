import { describe, it, expect } from "vitest";
import { TARIFS, planValide, tauxCollab, tauxAffiliation, limiteCampagnesActives } from "@/lib/tarifs";
import { messageCapaciteAtteinte } from "@/lib/limites";

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

describe("limiteCampagnesActives", () => {
  it("donne la capacité de chaque plan", () => {
    expect(limiteCampagnesActives("free")).toBe(1);
    expect(limiteCampagnesActives("growth")).toBe(5);
    // Scale : sans limite.
    expect(limiteCampagnesActives("scale")).toBeNull();
  });

  it("retombe sur le plan gratuit pour une valeur inconnue", () => {
    // Jamais l'inverse : on n'offre pas la capacité d'un plan non souscrit.
    expect(limiteCampagnesActives(null)).toBe(1);
    expect(limiteCampagnesActives("entreprise")).toBe(1);
  });
});

describe("messageCapaciteAtteinte", () => {
  it("dit le plan, le compte, et les DEUX façons d'avancer", () => {
    const m = messageCapaciteAtteinte({
      plan: "free",
      libellePlan: "Gratuit",
      actives: 1,
      limite: 1,
      disponible: false,
    });
    expect(m).toContain("Gratuit");
    expect(m).toContain("une seule campagne active");
    // La sortie gratuite est proposée avant la sortie payante.
    expect(m.indexOf("pause")).toBeLessThan(m.indexOf("plan supérieur"));
    // Et on rassure sur ce qui n'est PAS bloqué.
    expect(m).toContain("collaborations en cours");
  });

  it("accorde le pluriel sur un plan à plusieurs campagnes", () => {
    const m = messageCapaciteAtteinte({
      plan: "growth",
      libellePlan: "Growth",
      actives: 5,
      limite: 5,
      disponible: false,
    });
    expect(m).toContain("5 campagnes actives");
  });
});
