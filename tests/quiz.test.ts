import { describe, it, expect } from "vitest";
import {
  lireLienProfil,
  avancementCreateur,
  avancementMarque,
  carteCreateurVide,
  carteMarqueVide,
  libelleTranche,
  premiereEtapeIncomplete,
} from "@/lib/quiz";

describe("lireLienProfil", () => {
  it("lit une URL complète et en tire le pseudo ET la plateforme", () => {
    expect(lireLienProfil("https://www.tiktok.com/@ines.fit")).toEqual({
      handle: "ines.fit",
      plateforme: "tiktok",
    });
    expect(lireLienProfil("https://instagram.com/maya.style")).toEqual({
      handle: "maya.style",
      plateforme: "instagram",
    });
    // La casse est conservée telle que `extractHandleFromUrl` la rend : un
    // pseudo YouTube s'affiche comme son propriétaire l'a écrit.
    expect(lireLienProfil("https://youtube.com/@MartinDRN")).toEqual({
      handle: "MartinDRN",
      plateforme: "youtube",
    });
  });

  it("accepte ce que les gens collent vraiment, sans protocole", () => {
    // Un questionnaire qui exige « https:// » perd la personne à la première
    // question. C'est le cas le plus fréquent, pas un cas limite.
    expect(lireLienProfil("tiktok.com/@ines.fit")).toEqual({
      handle: "ines.fit",
      plateforme: "tiktok",
    });
    expect(lireLienProfil("  www.instagram.com/maya.style  ")).toEqual({
      handle: "maya.style",
      plateforme: "instagram",
    });
  });

  it("accepte un simple pseudo quand la plateforme est déjà connue", () => {
    expect(lireLienProfil("@ines.fit", "tiktok")).toEqual({
      handle: "ines.fit",
      plateforme: "tiktok",
    });
    expect(lireLienProfil("ines.fit", "tiktok")).toEqual({
      handle: "ines.fit",
      plateforme: "tiktok",
    });
  });

  it("refuse un pseudo seul quand on ignore la plateforme", () => {
    // Sans plateforme, la carte serait incomplète et l'écran doit la demander.
    expect(lireLienProfil("@ines.fit")).toBeNull();
  });

  it("refuse ce qui n'est ni un lien ni un pseudo", () => {
    expect(lireLienProfil("")).toBeNull();
    expect(lireLienProfil("   ")).toBeNull();
    expect(lireLienProfil("deux mots", "tiktok")).toBeNull();
    expect(lireLienProfil("exemple.fr/quelquun")).toBeNull();
  });
});

describe("avancementCreateur", () => {
  it("part de zéro et dit tout ce qui manque", () => {
    const a = avancementCreateur(carteCreateurVide());
    expect(a.pourcentage).toBe(0);
    expect(a.montrable).toBe(false);
    expect(a.manquants).toHaveLength(5);
  });

  it("devient montrable dès le pseudo et le réseau", () => {
    // Montrable ≠ complet : on veut un aperçu vivant pendant qu'on répond,
    // sinon la personne remplit à l'aveugle.
    const a = avancementCreateur({
      ...carteCreateurVide(),
      handle: "ines.fit",
      plateforme: "tiktok",
    });
    expect(a.montrable).toBe(true);
    expect(a.pourcentage).toBe(40);
  });

  it("atteint 100 quand tout est répondu", () => {
    const a = avancementCreateur({
      cote: "creator",
      handle: "ines.fit",
      plateforme: "tiktok",
      audience: "micro",
      niches: ["Sport"],
      offres: ["ugc"],
      prixMini: 220,
    });
    expect(a.pourcentage).toBe(100);
    expect(a.manquants).toEqual([]);
  });
});

describe("avancementMarque", () => {
  it("réclame un montant dès qu'un mode de rémunération est choisi", () => {
    const a = avancementMarque({
      ...carteMarqueVide(),
      nom: "Lumi",
      produit: "cosmétiques",
      formats: ["post"],
      remuneration: "fixe",
    });
    expect(a.manquants).toContain("le montant");
  });

  it("se satisfait d'une commission seule", () => {
    const a = avancementMarque({
      ...carteMarqueVide(),
      nom: "Lumi",
      produit: "cosmétiques",
      formats: ["affil"],
      remuneration: "commission",
      commission: 8,
    });
    expect(a.pourcentage).toBe(100);
  });
});

describe("libelleTranche", () => {
  it("rend le palier de marché", () => {
    expect(libelleTranche("nano")).toBe("Nano");
    expect(libelleTranche("macro")).toBe("Macro");
    expect(libelleTranche(null)).toBeNull();
  });
});

describe("premiereEtapeIncomplete", () => {
  it("reprend à la première question sans réponse", () => {
    const base = carteCreateurVide();
    expect(premiereEtapeIncomplete(base)).toBe(0);
    expect(premiereEtapeIncomplete({ ...base, handle: "a", plateforme: "tiktok" })).toBe(1);
    expect(
      premiereEtapeIncomplete({ ...base, handle: "a", plateforme: "tiktok", audience: "micro" }),
    ).toBe(2);
  });

  it("ne renvoie personne dans un questionnaire qu'il a fini", () => {
    // Sans ça, quelqu'un qui revient voit sa carte complète et s'entend
    // redemander son pseudo — il croit avoir tout perdu.
    expect(
      premiereEtapeIncomplete({
        cote: "creator",
        handle: "ines.fit",
        plateforme: "tiktok",
        audience: "micro",
        niches: ["Sport"],
        offres: ["ugc"],
        prixMini: 220,
      }),
    ).toBe(4);
  });
});
