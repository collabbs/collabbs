import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { attemptDealPayout } from "@/lib/deal-payout";
import { notify } from "@/lib/notifications";
import { eur } from "@/lib/deal";
import { reportError } from "@/lib/report-error";

/**
 * Application des délais du séquestre.
 *
 * Les champs `escrow_due_at` et `brand_validation_deadline_days` existent
 * depuis le 3 juin. Ils s'affichaient dans la timeline mais **rien ne les
 * appliquait** : une marque qui ne validait jamais bloquait indéfiniment
 * l'argent du créateur, sans recours.
 *
 * Deux règles, appliquées une fois par jour :
 *
 *  1. **Libération automatique.** Le créateur a tout livré, la marque n'a ni
 *     validé ni demandé de retouche dans le délai convenu → les fonds partent
 *     au créateur. Le silence de la marque vaut acceptation : c'est ce que dit
 *     le contrat, encore fallait-il l'appliquer.
 *
 *  2. **Relance de paiement.** La collaboration est acceptée mais la marque
 *     n'a pas réglé dans le délai. On relance sans rien annuler : couper une
 *     collaboration pour un retard de paiement punirait surtout le créateur,
 *     qui a peut-être déjà commencé à travailler.
 *
 * Prudence délibérée : on ne libère que si TOUS les livrables sont déposés et
 * qu'aucune retouche n'est en attente. En cas de doute, on ne touche pas à
 * l'argent — l'écran d'administration est là pour les cas ambigus.
 */


const DAY_MS = 86_400_000;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const result = { released: 0, skipped: 0, reminded: 0, failed: 0 };

  // ---------------------------------------------------------------
  // 1. Libération automatique après le délai de validation
  // ---------------------------------------------------------------
  const { data: actives } = await admin
    .from("deals")
    .select(
      "id, brand_id, creator_id, title, amount, status, brand_validation_deadline_days, brand_validated_at, deliverables(id, done, approved, submitted_at, revision_requested)",
    )
    .eq("status", "active")
    .is("brand_validated_at", null);

  for (const deal of (actives ?? [])) {
    const dels = deal.deliverables ?? [];
    if (dels.length === 0) continue;

    // Tout doit être livré, et rien ne doit être en cours de retouche.
    const allDelivered = dels.every((d) => d.done);
    const revisionPending = dels.some((d) => d.revision_requested);
    if (!allDelivered || revisionPending) {
      result.skipped++;
      continue;
    }

    // Le délai court depuis la DERNIÈRE livraison, pas la première : la marque
    // doit pouvoir juger l'ensemble.
    const times = dels
      .map((d) => (d.submitted_at ? new Date(d.submitted_at).getTime() : 0))
      .filter((t) => t > 0);
    if (times.length === 0) {
      result.skipped++;
      continue;
    }
    const lastDelivery = Math.max(...times);
    const deadlineDays = Number(deal.brand_validation_deadline_days ?? 5);
    if (now < lastDelivery + deadlineDays * DAY_MS) {
      result.skipped++;
      continue;
    }

    // Le paiement doit être en séquestre : sans argent, rien à libérer.
    const { data: tx } = await admin
      .from("transactions")
      .select("id, status, net_amount")
      .eq("deal_id", deal.id)
      .eq("type", "deal_payment")
      .maybeSingle();
    if (!tx || tx.status !== "in_escrow") {
      result.skipped++;
      continue;
    }

    const validatedAt = new Date().toISOString();
    const { error: errCloture } = await admin
      .from("deals")
      .update({ status: "completed", brand_validated_at: validatedAt })
      .eq("id", deal.id);
    if (errCloture) {
      // `attemptDealPayout` exige un deal « terminé » : sans cette écriture, il
      // refuserait de verser et la collaboration resterait bloquée sans que
      // personne ne l'apprenne.
      await reportError("cron/escrow-sla-cloture", errCloture, { detail: `deal ${deal.id}` });
      result.failed++;
      continue;
    }
    await admin
      .from("deliverables")
      .update({ approved: true })
      .eq("deal_id", deal.id);

    const payout = await attemptDealPayout(deal.id);
    if (!payout.released) {
      // Le versement peut échouer si le créateur n'a pas fini de connecter son
      // compte. La collaboration reste close et validée : `releaseDealPayout`
      // pourra reprendre plus tard, et l'écran d'administration le montre.
      result.failed++;
      await notify({
        userId: deal.creator_id,
        type: "escrow_auto_validated_pending_payout",
        title: "Ta livraison est validée automatiquement",
        body:
          `La marque n'a pas répondu dans le délai de ${deadlineDays} jours : la collaboration est validée. ` +
          `Le versement n'a pas encore pu partir — vérifie que ton compte de paiement est bien connecté.`,
        link: "/payouts",
      });
      continue;
    }

    result.released++;
    await notify({
      userId: deal.creator_id,
      type: "escrow_auto_released",
      title: `Validation automatique — ${eur(Number(tx.net_amount))} en route`,
      body:
        `La marque n'a ni validé ni demandé de retouche dans le délai de ${deadlineDays} jours ` +
        `suivant ta livraison. La collaboration est close et les fonds t'ont été versés.`,
      link: `/deals/${deal.id}`,
    });
    await notify({
      userId: deal.brand_id,
      type: "escrow_auto_released",
      title: "Collaboration validée automatiquement",
      body:
        `Le délai de ${deadlineDays} jours pour valider « ${deal.title ?? "la livraison"} » est écoulé sans réponse de ta part. ` +
        `Conformément au contrat, la livraison est réputée acceptée et les fonds ont été versés au créateur.`,
      link: `/deals/${deal.id}`,
    });
  }

  // ---------------------------------------------------------------
  // 2. Relance des collaborations acceptées mais non réglées
  // ---------------------------------------------------------------
  const { data: unpaid } = await admin
    .from("deals")
    .select("id, brand_id, creator_id, title, amount, escrow_due_at")
    .eq("status", "active")
    .not("escrow_due_at", "is", null)
    .lt("escrow_due_at", new Date().toISOString());

  for (const deal of (unpaid ?? [])) {
    const { data: tx } = await admin
      .from("transactions")
      .select("id")
      .eq("deal_id", deal.id)
      .eq("type", "deal_payment")
      .maybeSingle();
    if (tx) continue; // déjà réglé

    result.reminded++;
    await notify({
      userId: deal.brand_id,
      type: "escrow_payment_overdue",
      title: `Paiement en retard — ${eur(Number(deal.amount ?? 0))}`,
      body:
        `Le créateur a accepté « ${deal.title ?? "la collaboration"} » et attend ton règlement pour démarrer. ` +
        `Tant que les fonds ne sont pas séquestrés, il n'a aucune garantie d'être payé.`,
      link: `/deals/${deal.id}`,
      throttleMinutes: 2880,
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
