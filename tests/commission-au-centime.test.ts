// La commission d'une collaboration doit être au CENTIME, comme celle
// d'affiliation. Elle était arrondie à l'euro entier par un `Math.round` :
// 10 % de 25 € donnait 3 € au lieu de 2,50 €, alors que l'écran annonce
// « Commission Collabbs (10 %) ». Le montant contredisait son libellé, et
// l'écart partait toujours du même côté — `Math.round(2.5)` arrondit vers le
// haut, donc toujours en faveur de Collabbs.
//
// Constaté le 14/10/2026 en préparant un vrai paiement de test à 25 €.
import { describe, expect, it } from "vitest";
import { commissionCollabbs, dealBreakdown } from "@/lib/deal";

describe("la commission d'une collaboration se compte au centime", () => {
  it("rend 2,50 € sur 25 € à 10 %, et non 3 €", () => {
    expect(commissionCollabbs(25, 0.1)).toBe(2.5);
  });

  it("ne perd pas les centimes sur un montant quelconque", () => {
    expect(commissionCollabbs(2999, 0.1)).toBe(299.9);
    expect(commissionCollabbs(137, 0.1)).toBe(13.7);
  });

  it("n'arrondit jamais systématiquement vers le haut", () => {
    // C'était le vrai défaut : `Math.round` sur un demi faisait toujours
    // pencher l'écart du même côté, celui de la plateforme.
    for (const m of [5, 15, 25, 35, 45]) {
      expect(commissionCollabbs(m, 0.1)).toBe(m / 10);
    }
  });

  it("le total déboursé par la marque reste la somme exacte", () => {
    const b = dealBreakdown(25, "free");
    expect(b.net).toBe(25);
    expect(b.fee).toBe(2.5);
    expect(b.gross).toBe(27.5);
  });

  it("ne laisse pas filer un flottant dans la comptabilité", () => {
    // 0.1 + 0.2 = 0.30000000000000004 : sans arrondi explicite, ce genre de
    // valeur finit dans un montant affiché ou, pire, dans un virement.
    const b = dealBreakdown(0.3, "free");
    expect(Number.isInteger(b.gross * 100)).toBe(true);
    expect(Number.isInteger(b.fee * 100)).toBe(true);
  });
});
