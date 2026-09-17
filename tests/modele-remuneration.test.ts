import { describe, it, expect } from "vitest";
import { termesDealSchema } from "@/lib/schemas/deals";
import {
  avecCommission,
  modeleValide,
  montantAFixer,
  MODELE_LABEL,
  LIBELLE_MONTANT,
  MODELES_REMUNERATION,
} from "@/lib/deal";

const BASE = { quantity: 1, deadline: null, brandNotes: null };

describe("modèle de rémunération", () => {
  it("une valeur inconnue retombe sur le forfait, jamais sur mieux", () => {
    for (const v of [null, "", "FORFAIT", "gratuit", "cpa_tiers"]) {
      expect(modeleValide(v)).toBe("forfait");
    }
    // Et les vrais modèles passent, eux.
    for (const m of MODELES_REMUNERATION) expect(modeleValide(m)).toBe(m);
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

describe("les modèles à commission", () => {
  it("l'affiliation pure exige un taux et une destination, pas un montant", () => {
    const sans = termesDealSchema.safeParse({ ...BASE, modele: "affiliation", amount: 0 });
    expect(sans.success).toBe(false);

    const complet = termesDealSchema.safeParse({
      ...BASE,
      modele: "affiliation",
      amount: 0,
      commission: 10,
      urlDestination: "https://ma-boutique.fr/serum",
    });
    expect(complet.success).toBe(true);
  });

  it("une destination qui n'est pas une adresse est refusée", () => {
    // Sans destination valable, le lien renvoie ailleurs et le créateur envoie
    // son audience nulle part.
    for (const url of ["ma-boutique", "boutique.fr", "javascript:alert(1)", ""]) {
      const r = termesDealSchema.safeParse({
        ...BASE, modele: "affiliation", amount: 0, commission: 10, urlDestination: url,
      });
      expect(r.success).toBe(false);
    }
  });

  it("le fixe + commission exige les deux", () => {
    const base = {
      ...BASE, modele: "hybride", commission: 8,
      urlDestination: "https://ma-boutique.fr",
    };
    // Sans partie fixe, c'est une affiliation qui ne dit pas son nom : le
    // créateur croit avoir une garantie et n'en a aucune.
    expect(termesDealSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(termesDealSchema.safeParse({ ...base, amount: 200 }).success).toBe(true);
    expect(
      termesDealSchema.safeParse({ ...base, amount: 200, commission: null }).success,
    ).toBe(false);
  });

  it("une commission au-delà de 50 % est refusée", () => {
    // Au-delà, la marque perd de l'argent sur chaque vente — ce n'est jamais
    // ce qu'elle voulait taper.
    const r = termesDealSchema.safeParse({
      ...BASE, modele: "affiliation", amount: 0, commission: 80,
      urlDestination: "https://ma-boutique.fr",
    });
    expect(r.success).toBe(false);
  });

  it("seuls l'affiliation et l'hybride versent une commission", () => {
    expect(avecCommission("affiliation")).toBe(true);
    expect(avecCommission("hybride")).toBe(true);
    for (const m of ["forfait", "performance", "produit"] as const) {
      expect(avecCommission(m)).toBe(false);
    }
  });

  it("l'affiliation pure ne réclame jamais de montant à fixer", () => {
    expect(montantAFixer("affiliation", 0)).toBe(false);
    // L'hybride, si : sa partie fixe est une promesse.
    expect(montantAFixer("hybride", 0)).toBe(true);
  });
});
