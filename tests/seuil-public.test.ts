import { describe, it, expect } from "vitest";
import {
  etatParMarque,
  anneesPresentes,
  cleMarque,
  anneeDe,
  resume,
  LEGAL_THRESHOLD,
  type Ligne,
} from "@/lib/seuil-public";

const l = (p: Partial<Ligne> & { marque: string; montant: number }): Ligne => ({
  id: Math.random().toString(36).slice(2),
  libelle: "Collaboration",
  nature: "argent",
  date: "2026-03-15",
  ...p,
});

describe("regroupement par annonceur", () => {
  it("le cumul se fait par marque, pas globalement", () => {
    // Le contresens le plus répandu : additionner tous ses revenus et se croire
    // au-dessus du seuil, ou l'inverse.
    const etat = etatParMarque([l({ marque: "Alpha", montant: 600 }), l({ marque: "Beta", montant: 600 })], 2026);
    expect(etat).toHaveLength(2);
    expect(etat.every((e) => !e.obligatoire)).toBe(true);
  });

  it("deux collaborations modestes chez la même marque déclenchent l'obligation", () => {
    const etat = etatParMarque([l({ marque: "Alpha", montant: 600 }), l({ marque: "Alpha", montant: 600 })], 2026);
    expect(etat).toHaveLength(1);
    expect(etat[0].total).toBe(1200);
    expect(etat[0].obligatoire).toBe(true);
    expect(etat[0].restant).toBe(0);
  });

  it("la casse et les espaces ne créent pas deux marques", () => {
    const etat = etatParMarque(
      [l({ marque: "Alpha Cosmetics", montant: 600 }), l({ marque: "  alpha   cosmetics ", montant: 600 })],
      2026,
    );
    expect(etat).toHaveLength(1);
    expect(etat[0].obligatoire).toBe(true);
    // Le nom affiché reste celui de la première saisie, pas la clé normalisée.
    expect(etat[0].marque).toBe("Alpha Cosmetics");
  });
});

describe("les avantages en nature comptent comme de l'argent", () => {
  it("un produit offert rapproche du seuil autant qu'un virement", () => {
    const etat = etatParMarque(
      [l({ marque: "Alpha", montant: 500 }), l({ marque: "Alpha", montant: 500, nature: "nature" })],
      2026,
    );
    expect(etat[0].argent).toBe(500);
    expect(etat[0].nature).toBe(500);
    expect(etat[0].obligatoire).toBe(true);
  });

  it("une marque qui n'envoie que des cadeaux peut franchir le seuil", () => {
    const etat = etatParMarque(
      [
        l({ marque: "Alpha", montant: 400, nature: "nature" }),
        l({ marque: "Alpha", montant: 400, nature: "nature" }),
        l({ marque: "Alpha", montant: 400, nature: "nature" }),
      ],
      2026,
    );
    expect(etat[0].argent).toBe(0);
    expect(etat[0].obligatoire).toBe(true);
  });
});

describe("le seuil et son approche", () => {
  it("le seuil est atteint À 1 000 €, pas au-delà", () => {
    expect(etatParMarque([l({ marque: "A", montant: LEGAL_THRESHOLD })], 2026)[0].obligatoire).toBe(true);
    expect(etatParMarque([l({ marque: "A", montant: LEGAL_THRESHOLD - 1 })], 2026)[0].obligatoire).toBe(false);
  });

  it("on prévient à partir de 70 %", () => {
    expect(etatParMarque([l({ marque: "A", montant: 700 })], 2026)[0].approche).toBe(true);
    expect(etatParMarque([l({ marque: "A", montant: 699 })], 2026)[0].approche).toBe(false);
  });

  it("une marque au-dessus du seuil n'est pas « en approche » : elle y est", () => {
    const e = etatParMarque([l({ marque: "A", montant: 1500 })], 2026)[0];
    expect(e.obligatoire).toBe(true);
    expect(e.approche).toBe(false);
  });
});

describe("années", () => {
  it("le compteur est annuel : deux années ne se cumulent pas", () => {
    const lignes = [
      l({ marque: "Alpha", montant: 900, date: "2025-12-31" }),
      l({ marque: "Alpha", montant: 900, date: "2026-01-01" }),
    ];
    expect(etatParMarque(lignes, 2026)[0].total).toBe(900);
    expect(etatParMarque(lignes, 2025)[0].total).toBe(900);
    expect(anneesPresentes(lignes)).toEqual([2026, 2025]);
  });

  it("une date illisible ne casse rien, elle est ignorée", () => {
    expect(anneeDe("hier")).toBeNull();
    expect(etatParMarque([l({ marque: "A", montant: 900, date: "hier" })], 2026)).toEqual([]);
  });
});

describe("saisies incomplètes", () => {
  it("un montant nul, négatif ou illisible n'est pas compté", () => {
    for (const montant of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(etatParMarque([l({ marque: "A", montant })], 2026)).toEqual([]);
    }
  });

  it("une marque sans nom n'est pas comptée", () => {
    expect(etatParMarque([l({ marque: "   ", montant: 500 })], 2026)).toEqual([]);
  });

  it("cleMarque normalise sans perdre le contenu", () => {
    expect(cleMarque("  Alpha   Cosmetics  ")).toBe("alpha cosmetics");
  });
});

describe("tri et message", () => {
  it("la marque la plus proche du seuil s'affiche en premier", () => {
    const etat = etatParMarque(
      [l({ marque: "Petite", montant: 100 }), l({ marque: "Grosse", montant: 900 })],
      2026,
    );
    expect(etat.map((e) => e.marque)).toEqual(["Grosse", "Petite"]);
  });

  it("le message dit quoi faire, pas seulement où on en est", () => {
    const depasse = etatParMarque([l({ marque: "Alpha", montant: 1200 })], 2026)[0];
    expect(resume(depasse)).toContain("Contrat écrit obligatoire");
    const proche = etatParMarque([l({ marque: "Alpha", montant: 800 })], 2026)[0];
    expect(resume(proche)).toContain("200 €");
  });
});
