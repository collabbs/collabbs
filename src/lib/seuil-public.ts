import { LEGAL_THRESHOLD } from "@/lib/legal-threshold-const";

/**
 * Le suivi du seuil légal, version autonome.
 *
 * ─── Pourquoi un second module ───
 * `lib/legal-threshold` fait le même calcul, mais il est marqué `server-only`
 * et lit la base : il ne connaît que ce qui s'est passé SUR Collabbs. Or le
 * seuil, lui, compte tout — y compris les collaborations faites ailleurs, en
 * direct, par messagerie. Un créateur qui ne regarderait que son compte
 * Collabbs se croirait loin d'un seuil qu'il a déjà franchi.
 *
 * Ce module-ci ne lit rien et n'écrit nulle part. Il prend une liste de lignes
 * saisies à la main et rend un état. C'est ce qui permet de le faire tourner
 * entièrement dans le navigateur, sans compte, sans serveur, et sans qu'aucune
 * donnée ne parte — ce qui n'est pas un détail pour un outil où l'on tape ses
 * revenus et le nom de ses clients.
 *
 * ─── La règle, telle que le texte l'écrit ───
 * Article 1er du décret n° 2025-1137 : le contrat écrit est obligatoire quand
 * « la somme des rémunérations versées et de la valeur des avantages en nature
 * accordés à un influenceur par un annonceur au cours de la même année en
 * contrepartie d'une prestation ou d'un ensemble de prestations d'influence
 * commerciale par voie électronique poursuivant un même objectif promotionnel »
 * atteint 1 000 € HT.
 *
 * Trois conséquences que l'outil doit respecter, et que presque aucun article
 * de vulgarisation ne mentionne :
 *  · le cumul se fait PAR ANNONCEUR, pas globalement ;
 *  · les avantages en nature comptent pour leur valeur, comme de l'argent ;
 *  · et il ne concerne que les prestations « poursuivant un même objectif
 *    promotionnel ». Deux campagnes réellement distinctes s'apprécient
 *    séparément. La frontière n'a été tranchée par aucun juge : on cumule tout
 *    par défaut, et on le dit, parce que se croire en dessous coûte plus cher
 *    que de se croire au-dessus.
 */

export { LEGAL_THRESHOLD };

/** À partir de quelle part du seuil on prévient qu'on s'en approche. */
export const RATIO_ALERTE = 0.7;

/** Ce qu'on compte : de l'argent, ou la valeur d'un avantage en nature. */
export const NATURES = ["argent", "nature"] as const;
export type Nature = (typeof NATURES)[number];

export const NATURE_LABEL: Record<Nature, string> = {
  argent: "Rémunération",
  nature: "Avantage en nature",
};

/** Une ligne déclarée par le créateur. */
export type Ligne = {
  id: string;
  /** Le nom de l'annonceur, tel que le créateur l'écrit. */
  marque: string;
  libelle: string;
  /** En euros hors taxes. */
  montant: number;
  nature: Nature;
  /** Date au format AAAA-MM-JJ. C'est elle qui décide de l'année de rattachement. */
  date: string;
};

export type EtatMarque = {
  marque: string;
  argent: number;
  nature: number;
  total: number;
  /** Ce qu'il reste avant l'obligation. Zéro si elle est déjà déclenchée. */
  restant: number;
  /** Le contrat écrit est-il obligatoire pour ce couple ? */
  obligatoire: boolean;
  /** On s'en approche sans l'avoir atteint. */
  approche: boolean;
  lignes: Ligne[];
};

const arrondi = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Normalise un nom de marque pour le regroupement : la casse et les espaces ne comptent pas. */
export function cleMarque(marque: string): string {
  return marque.trim().toLowerCase().replace(/\s+/g, " ");
}

/** L'année d'une ligne, déduite de sa date. */
export function anneeDe(date: string): number | null {
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(date);
  return m ? Number(m[1]) : null;
}

/**
 * L'état du seuil, marque par marque, pour une année donnée.
 *
 * Les marques sont triées par total décroissant : celle qui approche du seuil
 * est celle qu'on doit voir en premier, pas celle dont le nom commence par A.
 */
export function etatParMarque(lignes: readonly Ligne[], annee: number): EtatMarque[] {
  const par = new Map<string, EtatMarque>();

  for (const l of lignes) {
    if (anneeDe(l.date) !== annee) continue;
    // Un montant nul, négatif ou illisible n'est pas une ligne : c'est une
    // saisie en cours. La compter fausserait le total sans rien apprendre.
    if (!Number.isFinite(l.montant) || l.montant <= 0) continue;

    const cle = cleMarque(l.marque);
    if (!cle) continue;

    const e =
      par.get(cle) ??
      {
        // On garde le nom tel que saisi la première fois, pas la clé normalisée :
        // le créateur doit relire ce qu'il a écrit.
        marque: l.marque.trim(),
        argent: 0,
        nature: 0,
        total: 0,
        restant: LEGAL_THRESHOLD,
        obligatoire: false,
        approche: false,
        lignes: [],
      };

    if (l.nature === "nature") e.nature = arrondi(e.nature + l.montant);
    else e.argent = arrondi(e.argent + l.montant);
    e.lignes.push(l);
    par.set(cle, e);
  }

  return [...par.values()]
    .map((e) => {
      const total = arrondi(e.argent + e.nature);
      const obligatoire = total >= LEGAL_THRESHOLD;
      return {
        ...e,
        total,
        restant: obligatoire ? 0 : arrondi(LEGAL_THRESHOLD - total),
        obligatoire,
        approche: !obligatoire && total >= LEGAL_THRESHOLD * RATIO_ALERTE,
        lignes: [...e.lignes].sort((a, b) => b.date.localeCompare(a.date)),
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Les années présentes dans les lignes, de la plus récente à la plus ancienne. */
export function anneesPresentes(lignes: readonly Ligne[]): number[] {
  const s = new Set<number>();
  for (const l of lignes) {
    const a = anneeDe(l.date);
    if (a !== null) s.add(a);
  }
  return [...s].sort((a, b) => b - a);
}

/**
 * La phrase qui résume la situation d'une marque.
 *
 * Écrite ici et pas dans le composant parce que c'est la seule chose que le
 * créateur va lire, et qu'elle doit dire ce qu'il faut FAIRE, pas seulement où
 * il en est.
 */
export function resume(e: EtatMarque): string {
  if (e.obligatoire) {
    return `Contrat écrit obligatoire. Le cumul avec ${e.marque} a dépassé ${LEGAL_THRESHOLD.toLocaleString("fr-FR")} € HT cette année.`;
  }
  if (e.approche) {
    return `Il reste ${e.restant.toLocaleString("fr-FR")} € avant que le contrat écrit devienne obligatoire avec ${e.marque}.`;
  }
  return `${e.restant.toLocaleString("fr-FR")} € avant le seuil.`;
}
