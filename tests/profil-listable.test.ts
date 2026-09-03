import { describe, it, expect } from "vitest";
import { evaluerProfil, phraseManquants } from "@/lib/profil-listable";

const complet = { pseudo: "maya", photo: "https://x/y.jpg", reseaux: 1, niches: 1, offres: 1 };

describe("evaluerProfil", () => {
  it("accepte un profil complet", () => {
    expect(evaluerProfil(complet)).toEqual({ listable: true, manquants: [] });
  });

  it("refuse un profil vide et dit tout ce qui manque", () => {
    const r = evaluerProfil({ pseudo: null, photo: null, reseaux: 0, niches: 0, offres: 0 });
    expect(r.listable).toBe(false);
    expect(r.manquants).toHaveLength(5);
  });

  it("exige le réseau — c'est la divergence qui faisait mentir le wizard", () => {
    // Le wizard affichait « Visible par les marques » sans réseau, alors que
    // le catalogue refusait ensuite d'afficher le profil.
    const r = evaluerProfil({ ...complet, reseaux: 0 });
    expect(r.listable).toBe(false);
    expect(r.manquants).toContain("au moins un réseau");
  });

  it("traite un pseudo vide ou en blancs comme absent", () => {
    expect(evaluerProfil({ ...complet, pseudo: "   " }).listable).toBe(false);
    expect(evaluerProfil({ ...complet, pseudo: "" }).manquants).toContain("un pseudo");
  });

  it("compose une phrase lisible", () => {
    expect(phraseManquants([])).toBe("");
    expect(phraseManquants(["une photo"])).toBe("Il te manque une photo.");
    expect(phraseManquants(["une photo", "au moins une offre"])).toBe(
      "Il te manque une photo et au moins une offre.",
    );
    expect(phraseManquants(["un pseudo", "une photo", "au moins une offre"])).toBe(
      "Il te manque un pseudo, une photo et au moins une offre.",
    );
  });
});
