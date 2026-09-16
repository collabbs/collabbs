import { describe, it, expect } from "vitest";
import { termesDealSchema } from "@/lib/schemas/deals";
import {
  modeleValide,
  montantAFixer,
  MODELE_LABEL,
  LIBELLE_MONTANT,
  MODELES_REMUNERATION,
} from "@/lib/deal";

const BASE = { quantity: 1, deadline: null, brandNotes: null };

describe("modèle de rémunération", () => {
  it("une valeur inconnue retombe sur le forfait, jamais sur mieux", () => {
    for (const v of [null, "", "affiliation", "FORFAIT", "gratuit"]) {
      expect(modeleValide(v)).toBe("forfait");
    }
  });

  it("chaque modèle a son libellé et son sens du montant", () => {
    for (const m of MODELES_REMUNERATION) {
      expect(MODELE_LABEL[m]).toBeTruthy();
      // Le même champ ne peut pas s'appeler pareil : un montant, un plafond et
      // la valeur d'un cadeau ne se saisissent pas avec la même intention.
      expect(LIBELLE_MONTANT[m]).toBeTruthy();
    }
    expect(new Set(Object.values(LIBELLE_MONTANT)).size).toBe(MODELES_REMUNERATION.length);
  });

  it("zéro ne veut plus dire « à fixer » sur un produit offert", () => {
    expect(montantAFixer("forfait", 0)).toBe(true);
    expect(montantAFixer("performance", 0)).toBe(true);
    expect(montantAFixer("produit", 0)).toBe(false);
    expect(montantAFixer("forfait", 300)).toBe(false);
  });
});

describe("ce que chaque modèle exige", () => {
  it("un forfait à 0 € est refusé — le créateur ne peut pas l'accepter", () => {
    const r = termesDealSchema.safeParse({ ...BASE, modele: "forfait", amount: 0 });
    expect(r.success).toBe(false);
  });

  it("un produit offert à 0 € passe, mais seulement s'il est décrit", () => {
    expect(
      termesDealSchema.safeParse({ ...BASE, modele: "produit", amount: 0 }).success,
    ).toBe(false);
    expect(
      termesDealSchema.safeParse({
        ...BASE,
        modele: "produit",
        amount: 0,
        brandNotes: "Sérum vitamine C, 60 ml, valeur 49 €",
      }).success,
    ).toBe(true);
  });

  it("la performance exige un tarif aux vues", () => {
    expect(
      termesDealSchema.safeParse({ ...BASE, modele: "performance", amount: 400 }).success,
    ).toBe(false);
    expect(
      termesDealSchema.safeParse({
        ...BASE, modele: "performance", amount: 400, perfRate: 8,
      }).success,
    ).toBe(true);
  });

  it("un plafond inférieur au tarif de 1 000 vues est refusé", () => {
    // Sinon le plafond est atteint avant la première vue : la marque croit
    // payer aux vues et paie en réalité un forfait déguisé.
    const r = termesDealSchema.safeParse({
      ...BASE, modele: "performance", amount: 5, perfRate: 8,
    });
    expect(r.success).toBe(false);
  });

  it("sans modèle précisé, les règles d'avant continuent de s'appliquer", () => {
    // Les écrans qui ne touchent pas au modèle ne doivent pas casser.
    expect(termesDealSchema.safeParse({ ...BASE, amount: 200 }).success).toBe(true);
    expect(termesDealSchema.safeParse({ ...BASE, amount: 0 }).success).toBe(false);
  });
});
