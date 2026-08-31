import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fiabilité mesurée d'une marque.
 *
 * Une note étoilée se déclare ; une fiabilité se constate. Comme Collabbs tient
 * l'argent et l'horloge, elle sait exactement, pour chaque collaboration :
 *
 *   - la marque a-t-elle réglé dans le délai qui lui était donné ?
 *   - a-t-elle validé la livraison, ou le versement s'est-il déclenché tout
 *     seul faute de réponse ?
 *   - combien de tours de retouches a-t-elle demandés ?
 *
 * C'est ce qu'un créateur veut savoir avant d'accepter, et c'est précisément ce
 * qu'aucune plateforme déclarative ne peut lui dire.
 *
 * Principe de prudence : en dessous de trois collaborations terminées, on
 * n'affiche rien. Un pourcentage calculé sur un seul deal ne veut rien dire et
 * condamnerait injustement une marque qui a eu un retard une fois.
 */

/** Nombre de collaborations en dessous duquel on refuse de conclure. */
export const MIN_DEALS_FOR_RELIABILITY = 3;

export type BrandReliability = {
  /** Collaborations terminées prises en compte. */
  deals: number;
  /** Assez de données pour publier un indicateur ? */
  meaningful: boolean;
  /** Part des collaborations réglées dans le délai imparti (0–100). */
  paysOnTimePct: number | null;
  /** Part des livraisons validées par la marque elle-même (0–100). */
  validatesPct: number | null;
  /** Nombre moyen de tours de retouches demandés. */
  avgRevisions: number | null;
  /** Délai moyen de règlement après acceptation, en jours. */
  avgPaymentDays: number | null;
};


const DAY_MS = 86_400_000;

export async function brandReliability(brandId: string): Promise<BrandReliability> {
  const admin = createAdminClient();

  const { data: deals } = await admin
    .from("deals")
    .select(
      "id, status, accepted_at, escrow_due_at, brand_validated_at, revision_rounds_used, transactions(type, created_at)",
    )
    .eq("brand_id", brandId)
    .eq("status", "completed");

  const rows = deals ?? [];
  const empty: BrandReliability = {
    deals: rows.length,
    meaningful: false,
    paysOnTimePct: null,
    validatesPct: null,
    avgRevisions: null,
    avgPaymentDays: null,
  };
  if (rows.length < MIN_DEALS_FOR_RELIABILITY) return empty;

  let paidOnTime = 0;
  let paidCount = 0;
  let paymentDaysTotal = 0;
  let validatedBySelf = 0;
  let revisionsTotal = 0;

  for (const d of rows) {
    const payment = (d.transactions ?? []).find(
      (t) => t.type === "deal_payment",
    );

    if (payment?.created_at && d.accepted_at) {
      paidCount++;
      const paidAt = new Date(payment.created_at).getTime();
      const acceptedAt = new Date(d.accepted_at).getTime();
      paymentDaysTotal += Math.max(0, (paidAt - acceptedAt) / DAY_MS);
      // `escrow_due_at` est l'échéance qui lui était donnée pour régler.
      if (d.escrow_due_at && paidAt <= new Date(d.escrow_due_at).getTime()) {
        paidOnTime++;
      }
    }

    // Une collaboration close SANS `brand_validated_at` a été libérée
    // automatiquement : la marque n'a jamais répondu.
    if (d.brand_validated_at) validatedBySelf++;

    revisionsTotal += Number(d.revision_rounds_used ?? 0);
  }

  const pct = (n: number, total: number) =>
    total > 0 ? Math.round((n / total) * 100) : null;

  return {
    deals: rows.length,
    meaningful: true,
    paysOnTimePct: pct(paidOnTime, paidCount),
    validatesPct: pct(validatedBySelf, rows.length),
    avgRevisions: Math.round((revisionsTotal / rows.length) * 10) / 10,
    avgPaymentDays:
      paidCount > 0 ? Math.round((paymentDaysTotal / paidCount) * 10) / 10 : null,
  };
}

/**
 * Formule les indicateurs en phrases lisibles, avec leur tonalité.
 * Rien n'est renvoyé quand la donnée manque : mieux vaut ne rien dire que
 * meubler avec un indicateur creux.
 */
export function reliabilityHighlights(
  r: BrandReliability,
): { label: string; tone: "good" | "warn" | "neutral" }[] {
  if (!r.meaningful) return [];
  const out: { label: string; tone: "good" | "warn" | "neutral" }[] = [];

  if (r.paysOnTimePct !== null) {
    out.push({
      label:
        r.paysOnTimePct >= 90
          ? "Paie toujours dans les délais"
          : r.paysOnTimePct >= 60
            ? `Paie dans les délais ${r.paysOnTimePct} % du temps`
            : `Souvent en retard de paiement (${r.paysOnTimePct} % dans les délais)`,
      tone: r.paysOnTimePct >= 90 ? "good" : r.paysOnTimePct >= 60 ? "neutral" : "warn",
    });
  }

  if (r.validatesPct !== null) {
    out.push({
      label:
        r.validatesPct >= 90
          ? "Valide les livraisons sans traîner"
          : r.validatesPct >= 60
            ? `Valide ${r.validatesPct} % des livraisons elle-même`
            : "Laisse souvent la validation se faire automatiquement",
      tone: r.validatesPct >= 90 ? "good" : r.validatesPct >= 60 ? "neutral" : "warn",
    });
  }

  if (r.avgRevisions !== null && r.avgRevisions > 0) {
    out.push({
      label:
        r.avgRevisions <= 0.5
          ? "Demande rarement des retouches"
          : `${r.avgRevisions} tour${r.avgRevisions > 1 ? "s" : ""} de retouches en moyenne`,
      tone: r.avgRevisions <= 1 ? "neutral" : "warn",
    });
  }

  return out;
}
