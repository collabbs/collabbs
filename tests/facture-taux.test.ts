import { describe, it, expect } from "vitest";
import { PLATFORM_FEE_RATE } from "@/lib/deal";
import { AFFILIATE_FEE_RATE } from "@/lib/affiliate-billing";

/**
 * `platform_fee_rate` a porté deux conventions : un taux (0,1) côté
 * collaboration, un pourcentage (25) côté affiliation. La facture multipliait
 * par 100 dans les deux cas et annonçait « Commission Collabbs (2500 %) » sur
 * les versements d'affiliation — un document remis à l'utilisateur.
 */
function pourcentageFrais(valeur: number): string {
  const pct = valeur > 1 ? valeur : valeur * 100;
  return pct.toFixed(0);
}

describe("taux de commission affiché sur la facture", () => {
  it("lit un taux, la convention retenue", () => {
    expect(pourcentageFrais(PLATFORM_FEE_RATE)).toBe("10");
    expect(pourcentageFrais(AFFILIATE_FEE_RATE)).toBe("25");
  });

  it("rattrape les lignes déjà écrites en pourcentage", () => {
    // Une facture émise ne se corrige pas rétroactivement : ces lignes
    // existent en base et doivent continuer de s'afficher juste.
    expect(pourcentageFrais(25)).toBe("25");
    expect(pourcentageFrais(10)).toBe("10");
  });

  it("les deux taux du produit restent sous 1, donc jamais ambigus", () => {
    expect(PLATFORM_FEE_RATE).toBeLessThan(1);
    expect(AFFILIATE_FEE_RATE).toBeLessThan(1);
  });
});
