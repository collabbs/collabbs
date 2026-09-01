import { describe, it, expect } from "vitest";
import {
  supplementDroits,
  palierPourDuree,
  libelleDroits,
  perimetreValide,
  PALIERS_DROITS,
} from "@/lib/droits";

describe("palierPourDuree", () => {
  it("prend le palier qui COUVRE la durée, jamais celui du dessous", () => {
    // 4 mois relèvent du palier 6 mois : facturer 4 au tarif de 3 reviendrait
    // à offrir un mois de publicité au détriment du créateur.
    expect(palierPourDuree(4).mois).toBe(6);
    expect(palierPourDuree(1).mois).toBe(1);
    expect(palierPourDuree(6).mois).toBe(6);
    expect(palierPourDuree(7).mois).toBe(12);
  });

  it("traite au-delà de 12 mois comme une cession sans limite", () => {
    expect(palierPourDuree(24).mois).toBeNull();
    expect(palierPourDuree(null).mois).toBeNull();
  });
});

describe("supplementDroits", () => {
  it("facture la durée selon la grille, sur les propres comptes de la marque", () => {
    expect(supplementDroits(300, 1, "organic")).toBe(45); // +15 %
    expect(supplementDroits(300, 6, "organic")).toBe(150); // +50 %
    expect(supplementDroits(300, 12, "organic")).toBe(240); // +80 %
  });

  it("double le supplément en publicité payante", () => {
    // Un budget média derrière le visage du créateur, c'est un autre métier.
    expect(supplementDroits(300, 6, "paid")).toBe(300);
    expect(supplementDroits(300, null, "paid")).toBe(900); // +150 % × 2
  });

  it("ne facture RIEN sans cession de droits", () => {
    expect(supplementDroits(300, 0, "organic")).toBe(0);
    expect(supplementDroits(300, -3, "paid")).toBe(0);
  });

  it("ne facture rien sur un contenu sans montant", () => {
    expect(supplementDroits(0, 6, "paid")).toBe(0);
  });

  it("arrondit à l'euro, comme la colonne qui le stocke", () => {
    // 250 × 15 % = 37,5 → 38. Rendre des centimes créerait un écart entre le
    // montant annoncé et le montant versé.
    expect(supplementDroits(250, 1, "organic")).toBe(38);
  });
});

describe("libelleDroits", () => {
  it("dit la durée, le périmètre et le pourcentage", () => {
    expect(libelleDroits(6, "paid")).toBe("6 mois · publicité payante — +100 %");
    expect(libelleDroits(null, "organic")).toBe(
      "Sans limite de durée · ses propres comptes — +150 %",
    );
  });
});

describe("perimetreValide", () => {
  it("retombe sur le périmètre le plus ÉTROIT", () => {
    // Un défaut permissif céderait des droits publicitaires que personne n'a
    // négociés.
    expect(perimetreValide(null)).toBe("organic");
    expect(perimetreValide("tout")).toBe("organic");
    expect(perimetreValide("paid")).toBe("paid");
  });
});

/**
 * Les cas exacts affichés par le calculateur public `/outils/droits-usage`.
 *
 * Cet outil est la première chose que verra un créateur qui ne connaît pas
 * Collabbs, et il chiffre de l'argent. Un écart entre ce qu'il annonce et ce
 * que le produit facture réellement serait pire qu'une absence d'outil : ce
 * serait une promesse démentie à la première collaboration.
 */
describe("valeurs affichées par le calculateur public", () => {
  it("l'état par défaut : 300 €, six mois, comptes propres → 450 €", () => {
    expect(supplementDroits(300, 6, "organic")).toBe(150);
  });

  it("la cession la plus lourde : sans limite, publicité payante → +300 %", () => {
    // 1,5 × 2 = 3. Sur 300 €, cela fait 900 € de droits pour 1 200 € au total.
    expect(supplementDroits(300, null, "paid")).toBe(900);
  });

  it("l'exemple raconté sur la page : 300 €, un an de publicité payante → 780 €", () => {
    // C'est le chiffre écrit en toutes lettres dans le texte de la page.
    // S'il change ici sans changer là-bas, la page ment.
    expect(300 + supplementDroits(300, 12, "paid")).toBe(780);
  });

  it("chaque palier proposé par le calculateur produit un supplément", () => {
    for (const p of PALIERS_DROITS) {
      expect(supplementDroits(300, p.mois, "organic")).toBeGreaterThan(0);
      expect(supplementDroits(300, p.mois, "paid")).toBe(
        supplementDroits(300, p.mois, "organic") * 2,
      );
    }
  });

  it("un montant vide ne produit aucun supplément plutôt qu'un NaN", () => {
    expect(supplementDroits(0, 12, "paid")).toBe(0);
    expect(supplementDroits(Number.NaN, 12, "paid")).toBe(0);
  });
});
