import { describe, it, expect } from "vitest";
import {
  supplementDroits,
  palierPourDuree,
  libelleDroits,
  perimetreValide,
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
