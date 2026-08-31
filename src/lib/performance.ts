/**
 * Rémunération aux vues.
 *
 * Une seule règle : le créateur touche ses vues au tarif convenu, sans jamais
 * dépasser le plafond que la marque a séquestré.
 *
 *     dû = min(vues / 1000 × tarif, plafond)
 *
 * Les deux bornes comptent autant l'une que l'autre. Sans plafond, une vidéo
 * virale enverrait à la marque une facture qu'elle n'a pas provisionnée — et
 * qu'on serait incapables de prélever, puisque le séquestre est déjà encaissé.
 * Sans le calcul aux vues, on retombe sur le forfait déguisé qu'était le
 * produit jusqu'ici.
 */

/** Le pas de facturation : les tarifs s'annoncent toujours pour 1 000 vues. */
const PALIER_VUES = 1000;

/**
 * Ce que doit la marque, en euros.
 *
 * Arrondi à l'euro parce que `deals.amount` et `transactions.net_amount` le
 * sont : rendre ici des centimes qu'aucune colonne ne sait stocker produirait
 * un écart entre le montant annoncé au créateur et le montant versé.
 *
 * L'arrondi est fait AVANT le plafonnement. Dans l'autre ordre, un dû de
 * 300,4 € sur un plafond de 300 € donnerait 300 €, puis un arrondi sans effet :
 * même résultat ici, mais l'ordre inverse laisse passer un dû arrondi
 * AU-DESSUS du plafond quand le plafond n'est pas entier. On ne dépasse jamais
 * ce qui est séquestré.
 */
export function montantAuxVues(
  vues: number,
  tarifPour1000: number,
  plafond: number,
): number {
  if (!(vues > 0) || !(tarifPour1000 > 0) || !(plafond > 0)) return 0;
  const brut = Math.round((vues / PALIER_VUES) * tarifPour1000);
  return Math.min(brut, Math.floor(plafond));
}

/**
 * Combien de vues faut-il pour toucher le plafond ?
 *
 * Affiché au créateur avant qu'il s'engage. C'est l'information qui manque
 * partout ailleurs sur le marché : « 8 € / 1000 vues, plafond 400 € » ne dit
 * rien tant qu'on n'a pas fait la division. Ici on la fait pour lui — à
 * 50 000 vues, tu touches le maximum.
 */
export function vuesPourAtteindreLePlafond(
  tarifPour1000: number,
  plafond: number,
): number | null {
  if (!(tarifPour1000 > 0) || !(plafond > 0)) return null;
  return Math.ceil((plafond / tarifPour1000) * PALIER_VUES);
}

/** Une collaboration payée aux vues se reconnaît à son tarif figé. */
export function estAuxVues(deal: { perf_rate?: number | string | null }): boolean {
  return deal.perf_rate != null && Number(deal.perf_rate) > 0;
}

/**
 * Où en est la collaboration aux vues ?
 *
 * Trois états seulement, parce qu'il n'y a que trois choses à savoir :
 * personne n'a rien déclaré, le créateur attend une validation, c'est validé.
 * Un état « contesté » a été volontairement écarté : la marque qui n'est pas
 * d'accord dispose déjà des rounds de retouche et de la messagerie, et un
 * quatrième état sans écran pour en sortir aurait bloqué l'argent.
 */
export type EtatVues = "a_declarer" | "a_valider" | "valide";

export function etatDesVues(deal: {
  perf_declared_at?: string | null;
  perf_validated_at?: string | null;
}): EtatVues {
  if (deal.perf_validated_at) return "valide";
  if (deal.perf_declared_at) return "a_valider";
  return "a_declarer";
}

/** Vues formatées : 1234567 → « 1 234 567 ». */
export const vues = (n: number) => n.toLocaleString("fr-FR");
