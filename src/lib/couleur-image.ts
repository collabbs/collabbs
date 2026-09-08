import { inflateSync } from "node:zlib";

/**
 * Tirer la couleur d'une marque de son logo.
 *
 * ─── Le manque ───
 * Les cartes sans photo tombaient toutes sur la même lueur violet/rose. Une
 * couleur inventée, identique pour Decathlon et pour Sephora : elle ne dit
 * rien de la marque, et on la reconnaît comme un fond par défaut.
 *
 * `theme-color` réglerait la question, mais c'est justement sur les sites
 * fermés qu'on en a besoin — et un site qui répond 403 ne donne pas sa
 * balise. Le logo, lui, reste accessible : il passe par le service de
 * favicons, qui répond pour des domaines qu'on ne peut pas joindre.
 *
 * ─── Pourquoi décoder à la main ───
 * Le projet n'embarque aucune bibliothèque d'image, et en ajouter une
 * (`sharp` : binaires natifs, ~30 Mo) pour lire quelques pixels d'une icône
 * serait disproportionné. Un PNG 8 bits non entrelacé se décode avec le
 * `zlib` de Node et une centaine de lignes — et c'est exactement ce que
 * servent les favicons, vérifié sur les huit marques testées.
 *
 * Les autres formats (SVG, WebP, entrelacé, 16 bits) renvoient `null` : la
 * carte garde alors son traitement neutre, ce qu'elle faisait déjà.
 *
 * ⚠️ Module serveur : `node:zlib` n'existe pas dans un navigateur.
 */

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** Canaux par pixel selon le type de couleur PNG. */
const CANAUX: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Tout ce qu'on sait tirer d'un logo, en une seule lecture. */
export type AnalyseLogo = {
  couleur: string | null;
  /** Le logo porte-t-il une vraie teinte, ou est-il noir/blanc ? */
  vive: boolean;
  /** Ses traits sont-ils majoritairement sombres ? Décide du fond qu'on lui met. */
  sombre: boolean;
  largeur: number;
  hauteur: number;
};

/**
 * Analyse complète d'un logo PNG : couleur, ton, dimensions.
 *
 * Une seule lecture pour les trois. La taille décide si le logo peut être
 * montré EN GRAND — une icône de 32 px ne peut pas — et le ton décide du fond
 * sur lequel on le pose. Les deviner séparément voudrait dire décoder deux
 * fois la même image.
 */
export function analyserLogo(octets: Uint8Array): AnalyseLogo | null {
  const img = decoderPng(octets);
  if (!img) return null;
  const teinte = couleurDominante(octets);

  let clairs = 0;
  let sombres = 0;
  for (let i = 0; i < img.pixels.length; i += 4) {
    if (img.pixels[i + 3] < 128) continue;
    const moyenne = (img.pixels[i] + img.pixels[i + 1] + img.pixels[i + 2]) / 3;
    if (moyenne > 128) clairs++;
    else sombres++;
  }

  return {
    couleur: teinte?.vive ? teinte.couleur : null,
    vive: teinte?.vive ?? false,
    sombre: sombres >= clairs,
    largeur: img.largeur,
    hauteur: img.hauteur,
  };
}

export type CouleurLogo = {
  /** `#rrggbb`. */
  couleur: string;
  /**
   * `true` si le logo porte une vraie teinte, `false` s'il est noir/blanc/gris.
   *
   * La distinction compte : Sephora et Gymshark sont réellement monochromes,
   * et leur inventer une couleur serait aussi faux que le violet d'avant.
   */
  vive: boolean;
};

/** Prédicteur du filtre 4, tel que défini par la spécification PNG. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

type Image = { largeur: number; hauteur: number; pixels: Uint8Array };

/**
 * Décode un PNG 8 bits non entrelacé en pixels RGBA.
 *
 * Exporté pour être testable seul : une erreur de dé-filtrage se voit sur les
 * pixels, pas sur la couleur moyenne qui en sort.
 */
export function decoderPng(octets: Uint8Array): Image | null {
  if (octets.length < 8) return null;
  for (let i = 0; i < 8; i++) if (octets[i] !== SIGNATURE[i]) return null;

  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  let largeur = 0;
  let hauteur = 0;
  let profondeur = 0;
  let type = 0;
  let entrelace = 0;
  let palette: Uint8Array | null = null;
  let transparence: Uint8Array | null = null;
  const donnees: Uint8Array[] = [];

  let p = 8;
  while (p + 8 <= octets.length) {
    const taille = vue.getUint32(p);
    const nom = String.fromCharCode(octets[p + 4], octets[p + 5], octets[p + 6], octets[p + 7]);
    const debut = p + 8;
    // Un morceau annoncé plus long que le fichier : image tronquée.
    if (debut + taille > octets.length) return null;

    if (nom === "IHDR") {
      largeur = vue.getUint32(debut);
      hauteur = vue.getUint32(debut + 4);
      profondeur = octets[debut + 8];
      type = octets[debut + 9];
      entrelace = octets[debut + 12];
    } else if (nom === "PLTE") palette = octets.subarray(debut, debut + taille);
    else if (nom === "tRNS") transparence = octets.subarray(debut, debut + taille);
    else if (nom === "IDAT") donnees.push(octets.subarray(debut, debut + taille));
    else if (nom === "IEND") break;

    p = debut + taille + 4; // + le CRC, qu'on ne vérifie pas
  }

  if (profondeur !== 8 || entrelace !== 0 || donnees.length === 0) return null;
  if (largeur <= 0 || hauteur <= 0 || largeur * hauteur > 4_000_000) return null;
  const canaux = CANAUX[type];
  if (!canaux) return null;
  if (type === 3 && !palette) return null;

  let brut: Uint8Array;
  try {
    const total = donnees.reduce((n, d) => n + d.length, 0);
    const assemble = new Uint8Array(total);
    let o = 0;
    for (const d of donnees) {
      assemble.set(d, o);
      o += d.length;
    }
    brut = new Uint8Array(inflateSync(assemble));
  } catch {
    return null;
  }

  const parLigne = largeur * canaux;
  // Chaque ligne est précédée d'un octet de filtre.
  if (brut.length < (parLigne + 1) * hauteur) return null;

  // Dé-filtrage : chaque octet se lit par rapport à son voisin de gauche (a)
  // et à celui du dessus (b). L'ordre est impératif — une ligne dépend de la
  // précédente déjà reconstruite.
  const plat = new Uint8Array(parLigne * hauteur);
  for (let y = 0; y < hauteur; y++) {
    const filtre = brut[y * (parLigne + 1)];
    const src = y * (parLigne + 1) + 1;
    const dst = y * parLigne;
    const dessus = dst - parLigne;
    for (let x = 0; x < parLigne; x++) {
      const v = brut[src + x];
      const a = x >= canaux ? plat[dst + x - canaux] : 0;
      const b = y > 0 ? plat[dessus + x] : 0;
      const c = x >= canaux && y > 0 ? plat[dessus + x - canaux] : 0;
      plat[dst + x] =
        filtre === 0
          ? v
          : filtre === 1
            ? (v + a) & 255
            : filtre === 2
              ? (v + b) & 255
              : filtre === 3
                ? (v + ((a + b) >> 1)) & 255
                : filtre === 4
                  ? (v + paeth(a, b, c)) & 255
                  : v;
    }
  }

  const pixels = new Uint8Array(largeur * hauteur * 4);
  for (let i = 0; i < largeur * hauteur; i++) {
    const o = i * canaux;
    let r: number;
    let g: number;
    let b: number;
    let alpha = 255;
    if (type === 3) {
      const idx = plat[o];
      const pal = palette!;
      if (idx * 3 + 2 >= pal.length) return null;
      r = pal[idx * 3];
      g = pal[idx * 3 + 1];
      b = pal[idx * 3 + 2];
      if (transparence && idx < transparence.length) alpha = transparence[idx];
    } else if (type === 0) {
      r = g = b = plat[o];
    } else if (type === 4) {
      r = g = b = plat[o];
      alpha = plat[o + 1];
    } else if (type === 2) {
      r = plat[o];
      g = plat[o + 1];
      b = plat[o + 2];
    } else {
      r = plat[o];
      g = plat[o + 1];
      b = plat[o + 2];
      alpha = plat[o + 3];
    }
    const d = i * 4;
    pixels[d] = r;
    pixels[d + 1] = g;
    pixels[d + 2] = b;
    pixels[d + 3] = alpha;
  }

  return { largeur, hauteur, pixels };
}

function hex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * La couleur dominante d'un logo PNG.
 *
 * On ne prend pas la moyenne : la moyenne d'un logo est toujours une bouillie
 * grisâtre, parce que le fond transparent et les contours tirent tout vers le
 * neutre. On regroupe les pixels colorés par teinte proche et on garde le
 * groupe le plus large — ce qui donne le bleu de Decathlon, pas un mauve.
 *
 * Les pixels quasi blancs, quasi noirs ou peu saturés sont écartés du vote :
 * ce sont des contours et des fonds. S'il n'en reste aucun, le logo est
 * réellement monochrome, et on renvoie sa nuance avec `vive: false`.
 */
export function couleurDominante(octets: Uint8Array): CouleurLogo | null {
  const img = decoderPng(octets);
  if (!img) return null;

  const groupes = new Map<string, { n: number; r: number; g: number; b: number }>();
  let opaques = 0;
  let neutreR = 0;
  let neutreG = 0;
  let neutreB = 0;
  let neutres = 0;

  const { pixels } = img;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha < 128) continue;
    opaques++;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const clarte = (max + min) / 2 / 255;
    const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));

    if (saturation < 0.25 || clarte > 0.92 || clarte < 0.06) {
      // Le blanc pur ne compte pas comme nuance : c'est le fond de l'icône.
      if (clarte <= 0.92) {
        neutreR += r;
        neutreG += g;
        neutreB += b;
        neutres++;
      }
      continue;
    }

    // Pas de moyenne globale : on regroupe par teinte proche (pas de 32).
    const cle = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const grp = groupes.get(cle) ?? { n: 0, r: 0, g: 0, b: 0 };
    grp.n++;
    grp.r += r;
    grp.g += g;
    grp.b += b;
    groupes.set(cle, grp);
  }

  if (opaques === 0) return null;

  let meilleur: { n: number; r: number; g: number; b: number } | null = null;
  for (const g of groupes.values()) if (!meilleur || g.n > meilleur.n) meilleur = g;

  // ⚠️ Une teinte MINORITAIRE reste la couleur de la marque.
  //
  // Le seuil de 4 % partait d'une bonne idée — ne pas prendre trois pixels
  // parasites pour une identité. Mais il ratait le cas le plus courant : un
  // logo dessiné sur un fond plein. Celui de Creatikk est un dégradé bleu et
  // violet posé sur du noir ; le noir gagne largement en surface, donc on
  // rendait « noir », et la carte devenait un aplat sombre sans vie.
  //
  // Le fond n'est pas l'identité, le SIGNE l'est. Dès qu'il existe assez de
  // pixels colorés pour ne pas être du bruit (un demi pour cent), c'est eux
  // qui décident.
  const PART_BRUIT = 0.005;
  if (meilleur && meilleur.n / opaques >= PART_BRUIT) {
    return {
      couleur: hex(meilleur.r / meilleur.n, meilleur.g / meilleur.n, meilleur.b / meilleur.n),
      vive: true,
    };
  }

  if (neutres > 0) {
    return { couleur: hex(neutreR / neutres, neutreG / neutres, neutreB / neutres), vive: false };
  }
  return null;
}
