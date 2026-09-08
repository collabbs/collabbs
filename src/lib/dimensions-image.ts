/**
 * Les dimensions d'une image, lues dans ses premiers octets.
 *
 * ─── Pourquoi ───
 * On récupérait n'importe quoi et on l'affichait en grand : un pixel de
 * traçage Facebook (1×1) sur la carte de creatikk.io, une bannière d'en-tête
 * `blue_header.png` sur celle de bobochic, `Header_12.png` sur lemlist et
 * pennylane. Toutes comptaient comme « une photo trouvée », et donnaient une
 * carte vide ou floue.
 *
 * Aucun filtre sur le NOM ne rattrape ça : `facebook.com/tr?id=…` ne contient
 * ni « pixel » ni « tracker », et `Header_12.png` est un nom de fichier
 * parfaitement banal. Les DIMENSIONS, elles, tranchent objectivement — un
 * mouchard fait 1×1, une bannière fait trois fois plus large que haute, une
 * photo produit est carrée ou portrait.
 *
 * ─── Pourquoi à la main ───
 * On ne décode pas l'image : les dimensions vivent dans son en-tête, dans les
 * premiers octets. Quelques dizaines de lignes couvrent PNG, JPEG, GIF et
 * WebP — soit la totalité de ce que servent les sites marchands.
 */

export type Dimensions = { largeur: number; hauteur: number };

const texte = (o: Uint8Array, debut: number, fin: number) =>
  String.fromCharCode(...o.subarray(debut, fin));

export function dimensionsImage(octets: Uint8Array): Dimensions | null {
  if (octets.length < 16) return null;
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);

  // ── PNG : tout est dans l'IHDR, toujours au même endroit ──
  if (octets[0] === 0x89 && texte(octets, 1, 4) === "PNG") {
    return { largeur: vue.getUint32(16), hauteur: vue.getUint32(20) };
  }

  // ── GIF : deux entiers 16 bits, petit-boutiens ──
  if (texte(octets, 0, 3) === "GIF") {
    return { largeur: vue.getUint16(6, true), hauteur: vue.getUint16(8, true) };
  }

  // ── WebP : trois encodages, trois emplacements ──
  if (texte(octets, 0, 4) === "RIFF" && texte(octets, 8, 12) === "WEBP") {
    const forme = texte(octets, 12, 16);
    if (forme === "VP8X" && octets.length > 30) {
      // 24 bits chacun, moins un (le format stocke « taille - 1 »).
      const l = (octets[24] | (octets[25] << 8) | (octets[26] << 16)) + 1;
      const h = (octets[27] | (octets[28] << 8) | (octets[29] << 16)) + 1;
      return { largeur: l, hauteur: h };
    }
    if (forme === "VP8L" && octets.length > 25) {
      const bits = octets[21] | (octets[22] << 8) | (octets[23] << 16) | (octets[24] << 24);
      return { largeur: (bits & 0x3fff) + 1, hauteur: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (forme === "VP8 " && octets.length > 30) {
      return {
        largeur: vue.getUint16(26, true) & 0x3fff,
        hauteur: vue.getUint16(28, true) & 0x3fff,
      };
    }
    return null;
  }

  // ── AVIF / HEIF : les dimensions sont dans une boîte « ispe » ──
  //
  // Ajouté après coup : lemlist.com sert TOUTES ses images en AVIF, et faute
  // de savoir le lire on les rejetait en bloc — le site paraissait vide alors
  // qu'il est plein de photos. Le format gagne du terrain, l'ignorer revenait
  // à condamner les sites les plus modernes.
  //
  // On ne parcourt pas l'arbre de boîtes : on cherche « ispe » dans l'en-tête.
  // Douze octets plus loin viennent la largeur et la hauteur.
  if (texte(octets, 4, 8) === "ftyp") {
    for (let i = 0; i + 20 < octets.length; i++) {
      if (texte(octets, i, i + 4) !== "ispe") continue;
      const largeur = vue.getUint32(i + 8);
      const hauteur = vue.getUint32(i + 12);
      if (largeur > 0 && hauteur > 0 && largeur < 100_000 && hauteur < 100_000) {
        return { largeur, hauteur };
      }
    }
    return null;
  }

  // ── JPEG : il faut parcourir les segments jusqu'au cadre (SOF) ──
  if (octets[0] === 0xff && octets[1] === 0xd8) {
    let p = 2;
    while (p + 9 < octets.length) {
      if (octets[p] !== 0xff) {
        p++; // octet de remplissage : on avance sans rien conclure
        continue;
      }
      const marqueur = octets[p + 1];
      // Les marqueurs SOF portent les dimensions. C4 (Huffman), C8 et CC
      // partagent la plage mais ne sont PAS des cadres — d'où l'exclusion.
      const estCadre =
        marqueur >= 0xc0 && marqueur <= 0xcf && marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc;
      if (estCadre) {
        return { hauteur: vue.getUint16(p + 5), largeur: vue.getUint16(p + 7) };
      }
      // Marqueurs sans charge utile : on avance de deux octets.
      if (marqueur === 0xd8 || (marqueur >= 0xd0 && marqueur <= 0xd9)) {
        p += 2;
        continue;
      }
      const taille = vue.getUint16(p + 2);
      if (taille < 2) return null;
      p += 2 + taille;
    }
    return null;
  }

  return null;
}

/** Largeur minimale d'une image digne d'occuper une carte entière. */
export const LARGEUR_MINIMALE = 500;

/**
 * L'image peut-elle porter une carte, au format portrait ?
 *
 * Deux refus, pour deux problèmes réels :
 *  · trop petite — c'est un mouchard, un pictogramme ou une vignette ;
 *  · trop large — c'est une bannière, et recadrée en portrait il n'en reste
 *    qu'une bande centrale qui ne veut rien dire.
 */
export function convientAUneCarte(d: Dimensions | null): boolean {
  if (!d || d.largeur < LARGEUR_MINIMALE || d.hauteur < 300) return false;
  const rapport = d.largeur / d.hauteur;
  return rapport <= 1.8;
}
