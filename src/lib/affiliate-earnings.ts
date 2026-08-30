/**
 * Ce qui compte comme un gain pour un créateur.
 *
 * Une seule définition, partagée par tous les écrans. Il y en avait autant que
 * d'écrans, et elles divergeaient : le tableau de bord additionnait les
 * commissions **rejetées** (de l'argent qui ne sera jamais versé) tout en
 * ignorant les **actions** (CPA) ; d'autres pages ne regardaient pas le statut
 * du tout. Le même créateur voyait des chiffres différents selon la page.
 *
 * Deux règles, et elles tiennent en deux lignes :
 *
 *  1. **Les ventes ET les actions comptent.** Une commission d'affiliation et
 *     une rémunération à l'action sont toutes deux des gains. Ne compter que
 *     les ventes rendait invisibles les gains d'une campagne au CPA.
 *
 *  2. **Le rejeté et le remboursé ne comptent pas.** Une vente annulée par la
 *     marque, une commission écartée : rien n'est dû. Tout le reste compte —
 *     y compris `unfunded` et `pending`, qui sont dus mais pas encore versés.
 *
 * Pour l'argent réellement DISPONIBLE, ce n'est pas cette règle qu'il faut,
 * mais le statut précis (`validated`, `paid`) : voir l'écran des paiements,
 * qui distingue mise de côté, acquise et déjà versée.
 */

/** Types d'événements qui rémunèrent le créateur. Un clic ne rapporte rien. */
export const EARNING_TYPES = ["sale", "action"] as const;

/** Statuts pour lesquels plus rien n'est dû. */
const CANCELLED_STATUSES = ["rejected", "refunded"];

export type EarningEvent = {
  type?: string | null;
  status?: string | null;
};

/** Vrai si cet événement représente une rémunération due au créateur. */
export function countsAsEarning(e: EarningEvent): boolean {
  if (!e.type || !(EARNING_TYPES as readonly string[]).includes(e.type)) return false;
  return !e.status || !CANCELLED_STATUSES.includes(e.status);
}

/**
 * Somme des commissions dues dans une liste d'événements.
 * `status` doit faire partie des colonnes sélectionnées — sans lui, on ne peut
 * pas écarter ce qui a été annulé.
 */
export function sumEarnings(
  events: (EarningEvent & { commission_amount?: number | string | null })[],
): number {
  const total = events
    .filter(countsAsEarning)
    .reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Colonnes minimales à sélectionner pour pouvoir appliquer la règle.
 * À concaténer avec ce dont l'écran a besoin en plus.
 */
export const EARNING_COLUMNS = "type, status, commission_amount";

/**
 * Libellés lisibles des statuts d'une commission. Utilisés à l'écran et dans
 * l'export comptable : un même statut doit se dire de la même façon partout.
 */
export const EARNING_STATUS_LABEL: Record<string, string> = {
  unfunded: "Non financée",
  pending: "Mise de côté",
  validated: "Acquise",
  paid: "Versée",
  refunded: "Remboursée",
  rejected: "Écartée",
};

export function earningStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return EARNING_STATUS_LABEL[status] ?? status;
}
