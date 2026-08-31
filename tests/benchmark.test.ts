import { describe, it, expect } from "vitest";
import {
  statistiquesTarifs,
  reperesTarifaires,
  phraseObservations,
  SEUIL_FIABILITE,
  REPERES_MARCHE,
} from "@/lib/benchmark";

describe("refus de conclure", () => {
  it("ne calcule rien en dessous du seuil, même avec des données propres", () => {
    const presque = Array.from({ length: SEUIL_FIABILITE - 1 }, (_, i) => 100 + i);
    expect(statistiquesTarifs(presque)).toBeNull();
  });

  it("calcule dès que le seuil est atteint", () => {
    const juste = Array.from({ length: SEUIL_FIABILITE }, (_, i) => 100 + i);
    expect(statistiquesTarifs(juste)?.n).toBe(SEUIL_FIABILITE);
  });

  it("ne calcule rien sur une liste vide", () => {
    expect(statistiquesTarifs([])).toBeNull();
  });
});

describe("nettoyage des observations", () => {
  it("écarte les zéros, qui sont des champs vides et non des tarifs bas", () => {
    const avecZeros = [0, 0, 0, 100, 100, 100, 100, 100, 100, 100, 100];
    const stats = statistiquesTarifs(avecZeros);
    expect(stats?.n).toBe(8);
    expect(stats?.median).toBe(100);
  });

  it("un zéro de trop repasse en dessous du seuil au lieu de gonfler le compte", () => {
    const sept = [0, 0, 100, 100, 100, 100, 100, 100, 100];
    expect(statistiquesTarifs(sept)).toBeNull();
  });

  it("écarte les valeurs négatives et non finies", () => {
    const sales = [-50, NaN, Infinity, 100, 100, 100, 100, 100, 100, 100, 100];
    expect(statistiquesTarifs(sales)?.n).toBe(8);
  });
});

describe("la médiane résiste à ce que la moyenne ne supporte pas", () => {
  it("un tarif extrême ne déplace pas la médiane", () => {
    const normaux = [150, 150, 150, 150, 150, 150, 150, 150];
    const avecExtreme = [...normaux, 3000];
    expect(statistiquesTarifs(normaux)?.median).toBe(150);
    expect(statistiquesTarifs(avecExtreme)?.median).toBe(150);
    // Pour mémoire : la moyenne serait passée de 150 € à 467 €.
  });

  it("les quartiles décrivent la dispersion", () => {
    const disperses = [50, 100, 150, 200, 250, 300, 350, 400];
    const stats = statistiquesTarifs(disperses);
    expect(stats?.q1).toBe(138);
    expect(stats?.median).toBe(225);
    expect(stats?.q3).toBe(313);
  });

  it("un marché sans dispersion donne trois fois le même chiffre", () => {
    const stats = statistiquesTarifs([200, 200, 200, 200, 200, 200, 200, 200]);
    expect(stats).toEqual({ n: 8, q1: 200, median: 200, q3: 200 });
  });

  it("l'ordre d'entrée n'a aucune influence", () => {
    const serie = [400, 50, 250, 100, 350, 150, 300, 200];
    expect(statistiquesTarifs(serie)).toEqual(
      statistiquesTarifs([...serie].reverse()),
    );
  });
});

describe("bascule vers les repères de marché", () => {
  it("emprunte des repères sourcés quand on ne peut pas mesurer", () => {
    const res = reperesTarifaires([100, 200]);
    expect(res.origine).toBe("marche");
    if (res.origine === "marche") {
      expect(res.observations).toBe(2);
      expect(res.reperes).toEqual(REPERES_MARCHE);
    }
  });

  it("utilise nos propres chiffres dès qu'ils existent", () => {
    const res = reperesTarifaires([100, 110, 120, 130, 140, 150, 160, 170]);
    expect(res.origine).toBe("collabbs");
  });

  it("chaque repère de marché porte une source vérifiable", () => {
    for (const r of REPERES_MARCHE) {
      expect(r.url).toMatch(/^https:\/\//);
      expect(r.source.length).toBeGreaterThan(0);
      expect(r.releveLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("ce qu'on dit quand on ne sait pas", () => {
  it("distingue zéro observation d'une seule", () => {
    expect(phraseObservations(0)).toContain("Aucune collaboration");
    expect(phraseObservations(1)).toContain("1 seule collaboration");
  });

  it("annonce combien il en manque plutôt que de laisser croire à une panne", () => {
    expect(phraseObservations(3)).toContain(String(SEUIL_FIABILITE));
  });
});
