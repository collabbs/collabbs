import { describe, it, expect } from "vitest";
import {
  profilVisible,
  manquantsProfil,
  completionProfil,
  phraseManquants,
} from "@/lib/profil-visible";

const COMPLET = { pseudo: true, photo: true, plateforme: true, niche: true, offre: true };

describe("visibilité d'un profil créateur", () => {
  it("les cinq éléments sont nécessaires, aucun n'est optionnel", () => {
    expect(profilVisible(COMPLET)).toBe(true);
    for (const cle of Object.keys(COMPLET) as (keyof typeof COMPLET)[]) {
      expect(profilVisible({ ...COMPLET, [cle]: false })).toBe(false);
    }
  });

  it("le pseudo et le réseau comptent — c'est ce que le tableau de bord oubliait", () => {
    // Un créateur sans pseudo n'apparaissait dans aucune recherche, et son
    // tableau de bord ne lui disait rien : invisible sans le savoir.
    expect(profilVisible({ ...COMPLET, pseudo: false })).toBe(false);
    expect(profilVisible({ ...COMPLET, plateforme: false })).toBe(false);
  });

  it("un profil visible est toujours à 100 %, et l'inverse", () => {
    expect(completionProfil(COMPLET)).toBe(100);
    for (const cle of Object.keys(COMPLET) as (keyof typeof COMPLET)[]) {
      const partiel = { ...COMPLET, [cle]: false };
      expect(completionProfil(partiel)).toBeLessThan(100);
      expect(profilVisible(partiel)).toBe(false);
    }
  });

  it("on nomme ce qui manque, jamais un pourcentage seul", () => {
    const vide = { pseudo: false, photo: false, plateforme: false, niche: false, offre: false };
    expect(manquantsProfil(COMPLET)).toEqual([]);
    expect(manquantsProfil(vide)).toHaveLength(5);
    // La photo d'abord : c'est elle qui fait s'arrêter une marque.
    expect(manquantsProfil(vide)[0]).toBe("ta photo");
  });

  it("la phrase se lit en français, pas comme une liste de champs", () => {
    expect(phraseManquants(["ta photo"])).toBe("ta photo");
    expect(phraseManquants(["ta photo", "ton pseudo"])).toBe("ta photo et ton pseudo");
    expect(phraseManquants(["ta photo", "ton pseudo", "une niche"])).toBe(
      "ta photo, ton pseudo et une niche",
    );
  });
});
