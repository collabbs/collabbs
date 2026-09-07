/**
 * Manipuler une couleur de marque sans lui mentir.
 *
 * La couleur arrive du site ou du logo : on ne la choisit pas, on la reçoit.
 * Elle peut donc être n'importe quoi — un bleu franc, un noir, un vert acide.
 * Le fond, le voile et l'encre doivent en découler, sinon on retombe sur des
 * valeurs fixes qui vont bien avec une marque et mal avec les autres.
 *
 * Module pur : aucune dépendance, utilisable côté navigateur comme serveur.
 */

export type Rvb = [number, number, number];

const borne = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** `#abc` ou `#aabbcc` → composantes. `null` si ce n'est pas une couleur. */
export function versRvb(couleur: string): Rvb | null {
  const v = couleur.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(v)) {
    return [
      parseInt(v[0] + v[0], 16),
      parseInt(v[1] + v[1], 16),
      parseInt(v[2] + v[2], 16),
    ];
  }
  if (/^[0-9a-f]{6}$/i.test(v)) {
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }
  return null;
}

export function versHex([r, g, b]: Rvb): string {
  return "#" + [r, g, b].map((v) => borne(v).toString(16).padStart(2, "0")).join("");
}

/** Mélange linéaire : `part` = 0 garde la couleur, 1 donne la cible. */
export function melanger(couleur: string, cible: Rvb, part: number): string {
  const rvb = versRvb(couleur);
  if (!rvb) return couleur;
  const p = Math.max(0, Math.min(1, part));
  return versHex([
    rvb[0] + (cible[0] - rvb[0]) * p,
    rvb[1] + (cible[1] - rvb[1]) * p,
    rvb[2] + (cible[2] - rvb[2]) * p,
  ]);
}

export const eclaircir = (c: string, p: number) => melanger(c, [255, 255, 255], p);
export const assombrir = (c: string, p: number) => melanger(c, [0, 0, 0], p);

/**
 * Luminance relative (norme WCAG), entre 0 et 1.
 *
 * Ce n'est pas la moyenne des composantes : l'œil est bien plus sensible au
 * vert qu'au bleu. Un bleu marine et un vert olive ont des moyennes proches et
 * des luminances très différentes — c'est ce qui décide si le blanc tient.
 */
export function luminance(couleur: string): number {
  const rvb = versRvb(couleur);
  if (!rvb) return 0;
  const [r, g, b] = rvb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Le noir ou le blanc, celui des deux qui se lira sur ce fond. */
export function encreLisible(couleur: string): "#ffffff" | "#0b0b0f" {
  // 0,42 plutôt que 0,5 : sur un fond moyen le blanc reste plus lisible que le
  // noir, parce que le texte de la carte est gras et large.
  return luminance(couleur) > 0.42 ? "#0b0b0f" : "#ffffff";
}

/** À quel point une couleur est colorée (0 = gris parfait, 1 = teinte pure). */
export function saturation(couleur: string): number {
  const rvb = versRvb(couleur);
  if (!rvb) return 0;
  const max = Math.max(...rvb);
  const min = Math.min(...rvb);
  if (max === min) return 0;
  return (max - min) / (255 - Math.abs(max + min - 255));
}
