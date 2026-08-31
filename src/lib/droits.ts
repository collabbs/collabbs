/**
 * Les droits d'usage, et ce qu'ils coûtent.
 *
 * Une collaboration paie la FABRICATION d'un contenu. Le droit de le
 * réutiliser ensuite — six mois sur le compte de la marque, ou pire, en
 * publicité payante avec un budget média derrière — est autre chose, et vaut
 * souvent davantage que la vidéo elle-même. Le produit laissait déjà la marque
 * fixer une durée, et le contrat l'écrivait ; personne ne la facturait.
 *
 * ─── Deux leviers, parce que le marché en a deux ───
 * · La DURÉE. Elle se paie, mais pas linéairement : douze mois ne valent pas
 *   douze fois un mois. Le premier mois est le plus cher, le reste s'amortit.
 *   Une formule « X % par mois » produirait +180 % à un an, ce qu'aucune marque
 *   n'accepte et qu'aucun créateur n'obtient. D'où une grille par paliers.
 * · Le PÉRIMÈTRE. Réutiliser sur ses propres comptes (organique) et pousser le
 *   contenu en publicité payante sont deux mondes : le second met un budget
 *   média derrière le visage du créateur, souvent auprès d'audiences qui ne le
 *   connaissent pas. Il vaut le double.
 *
 * ─── Le supplément va au CRÉATEUR ───
 * Intégralement, comme le reste : c'est son droit qu'on licencie. La commission
 * Collabbs s'ajoute par-dessus, à la charge de la marque, exactement comme sur
 * le montant du contenu — aucun second chemin d'argent.
 */

/** Périmètre de réutilisation. */
export const PERIMETRES = ["organic", "paid"] as const;
export type Perimetre = (typeof PERIMETRES)[number];

export const PERIMETRE_LABEL: Record<Perimetre, string> = {
  organic: "Ses propres comptes",
  paid: "Publicité payante",
};

export const PERIMETRE_DESCRIPTION: Record<Perimetre, string> = {
  organic:
    "La marque republie le contenu sur ses réseaux, son site, ses newsletters — sans budget publicitaire derrière.",
  paid: "La marque peut pousser le contenu en publicité payante, y compris auprès d'audiences qui ne connaissent pas le créateur.",
};

/**
 * Grille des suppléments, en pourcentage du montant du contenu.
 *
 * Les paliers sont ceux que pratiquent les agences UGC : un mois se négocie
 * autour de +15 %, un an autour de +80 %, et la perpétuité — qui est un
 * abandon définitif — autour de +150 %. On s'aligne plutôt que d'inventer une
 * échelle que ni la marque ni le créateur ne reconnaîtraient.
 */
export const PALIERS_DROITS: { mois: number | null; libelle: string; pct: number }[] = [
  { mois: 1, libelle: "1 mois", pct: 0.15 },
  { mois: 3, libelle: "3 mois", pct: 0.3 },
  { mois: 6, libelle: "6 mois", pct: 0.5 },
  { mois: 12, libelle: "12 mois", pct: 0.8 },
  { mois: null, libelle: "Sans limite de durée", pct: 1.5 },
];

/** Le périmètre payant double le supplément. */
const MULTIPLICATEUR: Record<Perimetre, number> = { organic: 1, paid: 2 };

/**
 * Le palier applicable à une durée.
 *
 * On prend le premier palier qui COUVRE la durée demandée : 4 mois relèvent du
 * palier 6 mois. Facturer 4 mois au tarif de 3 reviendrait à offrir un mois de
 * publicité — et arrondir vers le bas est précisément l'erreur qui se retourne
 * contre le créateur.
 */
export function palierPourDuree(mois: number | null): (typeof PALIERS_DROITS)[number] {
  if (mois === null) return PALIERS_DROITS[PALIERS_DROITS.length - 1];
  return (
    PALIERS_DROITS.find((p) => p.mois !== null && mois <= p.mois) ??
    PALIERS_DROITS[PALIERS_DROITS.length - 1]
  );
}

/**
 * Ce que coûtent les droits, en euros, pour un contenu à `montantContenu`.
 *
 * Arrondi à l'euro : `deals.amount` l'est, et rendre des centimes qu'aucune
 * colonne ne stocke créerait un écart entre le montant annoncé et le montant
 * versé.
 */
export function supplementDroits(
  montantContenu: number,
  mois: number | null,
  perimetre: Perimetre,
): number {
  if (!(montantContenu > 0)) return 0;
  // Une durée nulle ou négative n'est pas une cession de droits : c'est
  // l'absence de cession. On ne facture rien plutôt que d'appliquer un palier.
  if (mois !== null && !(mois > 0)) return 0;
  const palier = palierPourDuree(mois);
  return Math.round(montantContenu * palier.pct * MULTIPLICATEUR[perimetre]);
}

/** Phrase courte pour l'écran : « 6 mois, publicité payante — +100 % ». */
export function libelleDroits(mois: number | null, perimetre: Perimetre): string {
  const palier = palierPourDuree(mois);
  const pct = Math.round(palier.pct * MULTIPLICATEUR[perimetre] * 100);
  return `${palier.libelle} · ${PERIMETRE_LABEL[perimetre].toLowerCase()} — +${pct} %`;
}

export function perimetreValide(valeur: string | null | undefined): Perimetre {
  // Par défaut le périmètre le plus ÉTROIT. Un défaut permissif céderait des
  // droits publicitaires que personne n'a négociés.
  return (PERIMETRES as readonly string[]).includes(valeur ?? "")
    ? (valeur as Perimetre)
    : "organic";
}
