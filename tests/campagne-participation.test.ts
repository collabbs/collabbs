import { describe, it, expect } from "vitest";
import { besoinLienDeSuivi, besoinCandidature } from "@/lib/campaign";

/**
 * Deux offres étaient annoncées et impossibles à honorer : l'hybride promettait
 * un forfait qu'aucun chemin ne versait, et le CPA proposait de candidater là
 * où il fallait un lien de suivi.
 */
describe("comment un créateur participe à une campagne", () => {
  it("l'hybride demande les DEUX : le lien et la candidature", () => {
    expect(besoinLienDeSuivi("hybrid")).toBe(true);
    expect(besoinCandidature("hybrid")).toBe(true);
  });

  it("le CPA demande un lien, jamais une candidature", () => {
    for (const t of ["cpa_flat", "cpa_tiers"]) {
      expect(besoinLienDeSuivi(t)).toBe(true);
      expect(besoinCandidature(t)).toBe(false);
    }
  });

  it("l'affiliation pure demande un lien seul", () => {
    expect(besoinLienDeSuivi("affiliation")).toBe(true);
    expect(besoinCandidature("affiliation")).toBe(false);
  });

  it("le forfait et la performance demandent une candidature seule", () => {
    for (const t of ["video", "performance"]) {
      expect(besoinLienDeSuivi(t)).toBe(false);
      expect(besoinCandidature(t)).toBe(true);
    }
  });

  it("un code promo impose un lien, même sur une campagne au forfait", () => {
    // Le code promo est porté par le lien du créateur : sans lien, pas de code,
    // et la vente n'est attribuable à personne.
    expect(besoinLienDeSuivi("video", true)).toBe(true);
    expect(besoinCandidature("video")).toBe(true);
  });
});
