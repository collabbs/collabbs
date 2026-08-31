import { describe, it, expect } from "vitest";
import {
  montantAuxVues,
  vuesPourAtteindreLePlafond,
  estAuxVues,
  etatDesVues,
} from "@/lib/performance";

describe("montantAuxVues", () => {
  it("paie les vues au tarif convenu", () => {
    // 50 000 vues à 8 € / 1000 = 400 €
    expect(montantAuxVues(50_000, 8, 1000)).toBe(400);
  });

  it("ne dépasse JAMAIS le plafond séquestré", () => {
    // La vidéo fait 10× le score espéré. La marque n'a provisionné que 400 € ;
    // c'est tout ce qu'on peut verser, puisque c'est tout ce qu'on détient.
    expect(montantAuxVues(500_000, 8, 400)).toBe(400);
  });

  it("gère les tarifs à virgule sans les arrondir vers le haut", () => {
    // 1,50 € / 1000 est le tarif courant du micro-créateur. À 12 340 vues :
    // 18,51 € → 19 € après arrondi à l'euro.
    expect(montantAuxVues(12_340, 1.5, 500)).toBe(19);
  });

  it("rend 0 quand rien n'a été vu", () => {
    expect(montantAuxVues(0, 8, 400)).toBe(0);
  });

  it("rend 0 plutôt que de payer à l'envers sur des valeurs absurdes", () => {
    // Aucune de ces trois situations ne doit produire un versement.
    expect(montantAuxVues(-5000, 8, 400)).toBe(0);
    expect(montantAuxVues(50_000, -8, 400)).toBe(0);
    expect(montantAuxVues(50_000, 8, 0)).toBe(0);
  });

  it("reste sous un plafond non entier", () => {
    // Le dû arrondi (300 €) ne doit pas franchir un plafond de 299,60 €.
    expect(montantAuxVues(37_500, 8, 299.6)).toBe(299);
  });

  it("paie la première vue sans attendre le palier de 1000", () => {
    // 400 vues à 8 € / 1000 = 3,20 € → 3 €. Un créateur sous les 1 000 vues
    // n'est pas payé zéro : c'est un prorata, pas un seuil.
    expect(montantAuxVues(400, 8, 400)).toBe(3);
  });
});

describe("vuesPourAtteindreLePlafond", () => {
  it("dit au créateur à partir de combien de vues il touche le maximum", () => {
    expect(vuesPourAtteindreLePlafond(8, 400)).toBe(50_000);
  });

  it("arrondit vers le haut : atteindre le plafond, pas le frôler", () => {
    // 250 / 1,5 × 1000 = 166 666,67 → il en faut 166 667.
    expect(vuesPourAtteindreLePlafond(1.5, 250)).toBe(166_667);
  });

  it("ne répond rien quand la collaboration n'est pas aux vues", () => {
    expect(vuesPourAtteindreLePlafond(0, 400)).toBeNull();
    expect(vuesPourAtteindreLePlafond(8, 0)).toBeNull();
  });
});

describe("estAuxVues", () => {
  it("reconnaît une collaboration aux vues à son tarif figé", () => {
    expect(estAuxVues({ perf_rate: 8 })).toBe(true);
    // Supabase renvoie les `numeric` en chaîne.
    expect(estAuxVues({ perf_rate: "1.50" })).toBe(true);
  });

  it("laisse le forfait tranquille", () => {
    expect(estAuxVues({ perf_rate: null })).toBe(false);
    expect(estAuxVues({})).toBe(false);
  });
});

describe("etatDesVues", () => {
  it("suit les trois moments de la collaboration", () => {
    expect(etatDesVues({})).toBe("a_declarer");
    expect(etatDesVues({ perf_declared_at: "2026-08-30T10:00:00Z" })).toBe("a_valider");
    expect(
      etatDesVues({
        perf_declared_at: "2026-08-30T10:00:00Z",
        perf_validated_at: "2026-08-31T10:00:00Z",
      }),
    ).toBe("valide");
  });
});
