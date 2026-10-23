/**
 * Écrire un montant en euros. Deux fonctions, et pas une de plus.
 *
 * ─── Pourquoi ce fichier existe ───
 * Le produit écrivait l'argent de HUIT façons différentes. Relevé le
 * 23/10/2026 : `lib/deal.ts` exportait `eur` et `eurExact`, `lib/campaign.ts`
 * en réexportait une paire, `lib/validation.ts` avait `euros`, et huit
 * fichiers avaient recopié leur propre version — chacune avec ou sans espace,
 * avec ou sans centimes, parfois arrondie, parfois passée par
 * `style: "currency"`. Pour un versement de 1 400,50 € :
 *
 *     lib/deal.ts eur                       1 400,5€
 *     lib/deal.ts eurExact                  1 400,50€
 *     lib/validation.ts euros               1 400,50 €
 *     activity / campaigns / dashboard      1 400,5€
 *     favoris / SuiviSeuil / droits-usage   1 400,5 €
 *     EarningsCalculator / charts           1 401€
 *     invoices / contract-template          1 400,50 €
 *     track/action / sale-pixel             1 400,50 € (espace fine)
 *
 * Ce n'est pas une question de goût, parce que ça se voit À L'INTÉRIEUR d'un
 * même écran : sur `/payouts`, l'argent des collaborations s'affichait
 * « 32€ » et, trois centimètres plus bas, celui de l'affiliation
 * « 32,00€ » — les deux étant la même somme, due à la même personne.
 *
 * ─── Les deux règles ───
 * `montant` pour l'argent qu'on doit, qu'on détient ou qu'on a versé :
 * provision, séquestre, commissions, virements, factures, contrats. Toujours
 * au centime, parce qu'un montant amputé de ses centimes dans un document
 * comptable est une erreur, pas une abréviation.
 *
 * `tarif` pour ce qui n'a pas encore bougé : un prix affiché, une estimation,
 * un seuil légal, un budget de campagne. Les centimes n'y apparaissent que
 * s'ils existent — « 300 € » se lit mieux que « 300,00 € », et « 49,90 € »
 * reste exact.
 *
 * ─── Les espaces ───
 * Insécables, et ÉCRITES EN CLAIR (`\u00a0`) plutôt que laissées à
 * `toLocaleString`. Deux raisons.
 *
 * Insécables, parce qu'un montant ne se coupe pas : « 1 » en fin de ligne et
 * « 400,00 € » au début de la suivante se lit comme deux nombres. La
 * typographie française impose aussi l'espace avant le symbole €.
 *
 * Écrites en clair, parce que `toLocaleString("fr-FR")` rend un séparateur
 * différent selon les données de langue de la machine : ici, avec ICU 78.3,
 * une espace fine insécable (U+202F) ; ailleurs, une espace insécable
 * ordinaire (U+00A0). Les tests du produit en portaient la trace — l'un
 * attendait U+202F, un autre U+00A0, pour le même genre de montant. Et
 * U+202F n'existe pas dans l'encodage WinAnsi du PDF du contrat, que
 * `contract-pdf.tsx` doit donc convertir avant de dessiner. Un montant qu'on
 * affiche, qu'on imprime et qu'on teste ne doit pas changer selon la machine
 * qui l'exécute.
 */
const ESPACE = "\u00a0";

/** Groupe les milliers par espaces : 1400 → "1 400". */
function grouper(entier: string): string {
  return entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE);
}

/**
 * Argent dû, détenu ou versé. Toujours au centime.
 * 32 → "32,00 €" · 1400.5 → "1 400,50 €" · -12.3 → "-12,30 €"
 * (les espaces sont insécables)
 */
export function montant(n: number): string {
  const [entier, decimales] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "-" : ""}${grouper(entier)},${decimales}${ESPACE}€`;
}

/**
 * Prix, estimation, seuil, budget : les centimes seulement s'ils existent.
 * 300 → "300 €" · 49.9 → "49,90 €" · 1400.5 → "1 400,50 €"
 */
export function tarif(n: number): string {
  const [entier, decimales] = Math.abs(n).toFixed(2).split(".");
  const signe = n < 0 ? "-" : "";
  return decimales === "00"
    ? `${signe}${grouper(entier)}${ESPACE}€`
    : `${signe}${grouper(entier)},${decimales}${ESPACE}€`;
}
