import { describe, it, expect } from "vitest";
import { citySlug, cityLabel } from "@/lib/city";

/**
 * Normalisation des villes.
 *
 * Sans elle, « Paris », « paris » et « PARIS 11e » deviennent trois villes
 * distinctes et le filtre par ville ne regroupe rien. C'est le genre de bug
 * qu'on ne découvre qu'avec de vrais utilisateurs.
 */
describe("normalisation des villes", () => {
  it("regroupe les variations de casse et d'arrondissement", () => {
    for (const v of ["Paris", "paris", "PARIS", "Paris 11e", "Paris 11", "  Paris  "]) {
      expect(citySlug(v)).toBe("paris");
    }
  });

  it("ignore les accents", () => {
    expect(citySlug("Saint-Étienne")).toBe("saint-etienne");
    expect(citySlug("SAINT ETIENNE")).toBe("saint-etienne");
  });

  it("développe les abréviations courantes", () => {
    expect(citySlug("st etienne")).toBe("saint-etienne");
    expect(citySlug("Ste Foy")).toBe("sainte-foy");
  });

  it("retire un code postal collé au nom", () => {
    expect(citySlug("Marseille 13008")).toBe("marseille");
  });

  it("préserve les noms composés", () => {
    expect(citySlug("Aix-en-Provence")).toBe("aix-en-provence");
    expect(citySlug("Boulogne Billancourt")).toBe("boulogne-billancourt");
  });

  it("renvoie null sur une saisie vide", () => {
    expect(citySlug("")).toBeNull();
    expect(citySlug("   ")).toBeNull();
  });

  it("sait reformer un libellé lisible", () => {
    expect(cityLabel("aix-en-provence")).toBe("Aix-en-Provence");
  });
});
