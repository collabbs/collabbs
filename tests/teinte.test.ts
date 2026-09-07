import { describe, expect, it } from "vitest";
import {
  assombrir,
  eclaircir,
  encreLisible,
  luminance,
  melanger,
  saturation,
  versRvb,
} from "@/lib/teinte";

describe("versRvb", () => {
  it("lit les deux écritures", () => {
    expect(versRvb("#fff")).toEqual([255, 255, 255]);
    expect(versRvb("3643ba")).toEqual([0x36, 0x43, 0xba]);
  });

  it("refuse ce qui n'est pas une couleur", () => {
    // La valeur vient d'un site tiers et finit dans du style : sans ce refus,
    // n'importe quelle chaîne se retrouverait injectée dans du CSS.
    for (const v of ["", "rouge", "#12", "#gggggg", "url(x)"]) {
      expect(versRvb(v)).toBeNull();
    }
  });
});

describe("melanger", () => {
  it("interpole entre la couleur et la cible", () => {
    expect(melanger("#000000", [255, 255, 255], 0)).toBe("#000000");
    expect(melanger("#000000", [255, 255, 255], 1)).toBe("#ffffff");
    expect(melanger("#000000", [255, 255, 255], 0.5)).toBe("#808080");
  });

  it("rend la couleur inchangée si elle est illisible", () => {
    expect(melanger("pas une couleur", [255, 255, 255], 0.5)).toBe("pas une couleur");
  });

  it("éclaircit un noir pur — sinon une marque noire donne une carte morte", () => {
    expect(eclaircir("#000000", 0.36)).not.toBe("#000000");
    expect(assombrir("#3643ba", 0.62)).not.toBe("#3643ba");
  });
});

describe("luminance et encre", () => {
  it("classe les couleurs comme l'œil les voit", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1, 2);
    expect(luminance("#000000")).toBeCloseTo(0, 2);
    // Le vert paraît bien plus clair que le bleu à saturation égale : une
    // moyenne des composantes les mettrait à égalité et choisirait mal l'encre.
    expect(luminance("#00ff00")).toBeGreaterThan(luminance("#0000ff"));
  });

  it("choisit une encre qui se lit", () => {
    expect(encreLisible("#0c0c0c")).toBe("#ffffff"); // Sephora
    expect(encreLisible("#3643ba")).toBe("#ffffff"); // Decathlon
    expect(encreLisible("#ffe500")).toBe("#0b0b0f"); // une marque au jaune vif
  });
});

describe("saturation", () => {
  it("sépare un gris d'une teinte", () => {
    expect(saturation("#808080")).toBe(0);
    expect(saturation("#0000c8")).toBeGreaterThan(0.9);
  });
});
