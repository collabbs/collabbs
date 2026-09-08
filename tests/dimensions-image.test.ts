import { describe, expect, it } from "vitest";
import { convientAUneCarte, dimensionsImage } from "@/lib/dimensions-image";

/**
 * Ce lecteur décide quelles images atterrissent sur une carte. Une erreur de
 * décalage d'octets ne plante pas : elle rend des dimensions fausses, et on
 * remet un pixel de traçage en fond de carte sans que rien ne le signale.
 */

const oct = (...v: number[]) => new Uint8Array(v);

function png(largeur: number, hauteur: number): Uint8Array {
  const o = new Uint8Array(24);
  o.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(o.buffer).setUint32(16, largeur);
  new DataView(o.buffer).setUint32(20, hauteur);
  return o;
}

function gif(largeur: number, hauteur: number): Uint8Array {
  const o = new Uint8Array(16);
  o.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
  const v = new DataView(o.buffer);
  v.setUint16(6, largeur, true);
  v.setUint16(8, hauteur, true);
  return o;
}

/** Un JPEG minimal : un segment à ignorer, puis le cadre qui porte la taille. */
function jpeg(largeur: number, hauteur: number): Uint8Array {
  const o = new Uint8Array(40);
  const v = new DataView(o.buffer);
  o[0] = 0xff; o[1] = 0xd8; // début d'image
  o[2] = 0xff; o[3] = 0xe0; // APP0, à sauter
  v.setUint16(4, 16);
  const p = 4 + 16;
  o[p] = 0xff; o[p + 1] = 0xc0; // SOF0
  v.setUint16(p + 2, 17);
  o[p + 4] = 8; // précision
  v.setUint16(p + 5, hauteur);
  v.setUint16(p + 7, largeur);
  return o;
}

function webpVp8x(largeur: number, hauteur: number): Uint8Array {
  const o = new Uint8Array(32);
  o.set([...new TextEncoder().encode("RIFF")], 0);
  o.set([...new TextEncoder().encode("WEBP")], 8);
  o.set([...new TextEncoder().encode("VP8X")], 12);
  const l = largeur - 1;
  const h = hauteur - 1;
  o[24] = l & 255; o[25] = (l >> 8) & 255; o[26] = (l >> 16) & 255;
  o[27] = h & 255; o[28] = (h >> 8) & 255; o[29] = (h >> 16) & 255;
  return o;
}

describe("dimensionsImage", () => {
  it("lit un PNG", () => expect(dimensionsImage(png(1200, 1600))).toEqual({ largeur: 1200, hauteur: 1600 }));
  it("lit un GIF", () => expect(dimensionsImage(gif(640, 480))).toEqual({ largeur: 640, hauteur: 480 }));
  it("lit un WebP", () => expect(dimensionsImage(webpVp8x(800, 1000))).toEqual({ largeur: 800, hauteur: 1000 }));

  it("lit un JPEG en sautant les segments qui précèdent le cadre", () => {
    // Le piège du JPEG : la taille n'est pas à une position fixe, il faut
    // parcourir les segments. Un décalage d'un octet donne n'importe quoi.
    expect(dimensionsImage(jpeg(900, 1200))).toEqual({ largeur: 900, hauteur: 1200 });
  });

  it("repère le pixel de traçage", () => {
    // Le cas réel : creatikk.io servait un pixel Facebook 1×1 en fond de carte.
    expect(dimensionsImage(png(1, 1))).toEqual({ largeur: 1, hauteur: 1 });
    expect(convientAUneCarte(dimensionsImage(png(1, 1)))).toBe(false);
  });

  it("ne prétend rien sur un format qu'il ne connaît pas", () => {
    expect(dimensionsImage(new TextEncoder().encode("<svg xmlns='x'></svg>"))).toBeNull();
    expect(dimensionsImage(oct(0, 0, 0, 1))).toBeNull();
  });
});

describe("convientAUneCarte", () => {
  it("accepte une photo produit, carrée ou portrait", () => {
    expect(convientAUneCarte({ largeur: 1000, hauteur: 1000 })).toBe(true);
    expect(convientAUneCarte({ largeur: 900, hauteur: 1200 })).toBe(true);
  });

  it("refuse une bannière d'en-tête", () => {
    // `blue_header.png` (bobochic), `Header_12.png` (lemlist, pennylane) :
    // recadrées au format portrait, il n'en reste qu'une bande sans sujet.
    expect(convientAUneCarte({ largeur: 1920, hauteur: 400 })).toBe(false);
    expect(convientAUneCarte({ largeur: 2400, hauteur: 800 })).toBe(false);
  });

  it("refuse ce qui est trop petit pour occuper une carte", () => {
    expect(convientAUneCarte({ largeur: 1, hauteur: 1 })).toBe(false);
    expect(convientAUneCarte({ largeur: 320, hauteur: 320 })).toBe(false);
  });

  it("refuse quand on n'a pas su lire les dimensions", () => {
    // Sans mesure, on s'abstient : afficher une image inconnue en grand est
    // exactement ce qui a produit les mauvaises cartes.
    expect(convientAUneCarte(null)).toBe(false);
  });
});
