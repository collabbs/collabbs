import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { couleurDominante, decoderPng } from "@/lib/couleur-image";

/**
 * Un décodeur d'image écrit à la main sans test, c'est une bombe à retardement :
 * une erreur de dé-filtrage ne plante pas, elle produit une couleur légèrement
 * fausse — et on ne s'en aperçoit jamais.
 *
 * On encode donc de vrais PNG ici, en imposant CHAQUE type de filtre, et on
 * vérifie que ce qui ressort est exactement ce qui est entré.
 */

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (const o of buf) {
    c ^= o;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function morceau(nom: string, corps: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + corps.length);
  const vue = new DataView(out.buffer);
  vue.setUint32(0, corps.length);
  for (let i = 0; i < 4; i++) out[4 + i] = nom.charCodeAt(i);
  out.set(corps, 8);
  vue.setUint32(8 + corps.length, crc32(out.subarray(4, 8 + corps.length)));
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Encode du RGBA brut en PNG, en forçant le filtre demandé sur chaque ligne. */
function encoderPng(largeur: number, hauteur: number, rgba: Uint8Array, filtre = 0): Uint8Array {
  const bpp = 4;
  const parLigne = largeur * bpp;
  const brut = new Uint8Array((parLigne + 1) * hauteur);
  for (let y = 0; y < hauteur; y++) {
    brut[y * (parLigne + 1)] = filtre;
    for (let x = 0; x < parLigne; x++) {
      const v = rgba[y * parLigne + x];
      const a = x >= bpp ? rgba[y * parLigne + x - bpp] : 0;
      const b = y > 0 ? rgba[(y - 1) * parLigne + x] : 0;
      const c = x >= bpp && y > 0 ? rgba[(y - 1) * parLigne + x - bpp] : 0;
      const code =
        filtre === 0 ? v
        : filtre === 1 ? v - a
        : filtre === 2 ? v - b
        : filtre === 3 ? v - ((a + b) >> 1)
        : v - paeth(a, b, c);
      brut[y * (parLigne + 1) + 1 + x] = code & 255;
    }
  }
  const ihdr = new Uint8Array(13);
  const vue = new DataView(ihdr.buffer);
  vue.setUint32(0, largeur);
  vue.setUint32(4, hauteur);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  const parties = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    morceau("IHDR", ihdr),
    morceau("IDAT", new Uint8Array(deflateSync(brut))),
    morceau("IEND", new Uint8Array(0)),
  ];
  const total = parties.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parties) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Un damier : des voisins toujours différents, donc tous les filtres travaillent. */
function damier(largeur: number, hauteur: number, a: number[], b: number[]): Uint8Array {
  const px = new Uint8Array(largeur * hauteur * 4);
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const c = (x + y) % 2 === 0 ? a : b;
      px.set(c, (y * largeur + x) * 4);
    }
  }
  return px;
}

describe("decoderPng", () => {
  // Le cœur du test : si un filtre est mal implémenté, les pixels sortent faux.
  for (const filtre of [0, 1, 2, 3, 4]) {
    it(`restitue les pixels à l'identique avec le filtre ${filtre}`, () => {
      const source = damier(8, 6, [12, 200, 90, 255], [230, 40, 60, 128]);
      const img = decoderPng(encoderPng(8, 6, source, filtre));
      expect(img).not.toBeNull();
      expect(img!.largeur).toBe(8);
      expect(img!.hauteur).toBe(6);
      expect(Array.from(img!.pixels)).toEqual(Array.from(source));
    });
  }

  it("refuse ce qui n'est pas un PNG", () => {
    expect(decoderPng(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(decoderPng(new Uint8Array(0))).toBeNull();
    // Un SVG : c'est le cas réel, beaucoup de sites servent leur logo ainsi.
    expect(decoderPng(new TextEncoder().encode("<svg xmlns='...'></svg>"))).toBeNull();
  });

  it("refuse un fichier tronqué plutôt que de lire hors des octets", () => {
    const entier = encoderPng(4, 4, damier(4, 4, [0, 0, 255, 255], [255, 255, 255, 255]));
    expect(decoderPng(entier.subarray(0, entier.length - 30))).toBeNull();
  });
});

describe("couleurDominante", () => {
  it("trouve la teinte d'un logo coloré sur fond transparent", () => {
    // Un logo réel, c'est peu de pixels colorés dans beaucoup de vide : si on
    // prenait la moyenne, on obtiendrait un gris. On doit obtenir le bleu.
    const px = new Uint8Array(20 * 20 * 4);
    for (let i = 0; i < 20 * 20; i++) {
      const dedans = i % 20 >= 6 && i % 20 < 14 && i >= 120 && i < 280;
      px.set(dedans ? [40, 70, 190, 255] : [0, 0, 0, 0], i * 4);
    }
    const r = couleurDominante(encoderPng(20, 20, px));
    expect(r?.vive).toBe(true);
    const rvb = [1, 3, 5].map((i) => parseInt(r!.couleur.slice(i, i + 2), 16));
    expect(rvb[2]).toBeGreaterThan(rvb[0] + 60); // franchement bleu
  });

  it("dit qu'un logo noir et blanc n'a pas de teinte", () => {
    // Sephora, Gymshark, Nike : leur identité EST monochrome. Leur inventer
    // une couleur serait exactement le défaut qu'on corrige.
    const px = damier(10, 10, [17, 17, 17, 255], [255, 255, 255, 255]);
    const r = couleurDominante(encoderPng(10, 10, px));
    expect(r).not.toBeNull();
    expect(r!.vive).toBe(false);
  });

  it("ne renvoie rien quand tout est transparent", () => {
    expect(couleurDominante(encoderPng(4, 4, new Uint8Array(4 * 4 * 4)))).toBeNull();
  });

  it("ne renvoie rien pour un format qu'on ne sait pas lire", () => {
    expect(couleurDominante(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
});
