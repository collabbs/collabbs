"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { notify } from "@/lib/notifications";
import { releaseReservation } from "@/lib/affiliate-billing";
import { eur } from "@/lib/deal";
import { reportError } from "@/lib/report-error";

/**
 * Actions d'arbitrage.
 *
 * Ce sont les gestes qu'un litige impose et que personne d'autre ne peut faire :
 * débloquer un séquestre au bénéfice du créateur, ou le rendre à la marque.
 * Chaque geste prévient les deux parties — un arbitrage silencieux serait pire
 * que pas d'arbitrage du tout.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const untyped = (c: unknown) => c as any;

function back(msg: string, kind: "ok" | "error" = "ok"): never {
  redirect(`/admin?${kind === "ok" ? "done" : "error"}=${encodeURIComponent(msg)}`);
}

/**
 * Libère le séquestre au bénéfice du créateur, hors du parcours normal.
 * Usage : la marque ne valide jamais alors que la livraison est faite.
 */
export async function adminReleaseEscrow(formData: FormData) {
  await requireAdmin();
  if (!stripeConfigured) back("Stripe n'est pas configuré.", "error");

  const dealId = String(formData.get("dealId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!dealId) back("Deal introuvable.", "error");
  if (reason.length < 5) back("Motive ta décision — elle sera consignée.", "error");

  const admin = createAdminClient();
  const { data: tx } = await untyped(admin)
    .from("transactions")
    .select("id, deal_id, brand_id, creator_id, net_amount, status, reference")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (!tx) back("Aucun paiement trouvé pour ce deal.", "error");
  if (tx.status !== "in_escrow") back(`Ce paiement n'est pas en séquestre (${tx.status}).`, "error");

  const { data: creator } = await untyped(admin)
    .from("creators")
    .select("stripe_account_id")
    .eq("id", tx.creator_id)
    .maybeSingle();
  if (!creator?.stripe_account_id) {
    back("Le créateur n'a pas de compte de paiement connecté.", "error");
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(Number(tx.net_amount) * 100),
        currency: "eur",
        destination: creator.stripe_account_id as string,
        description: `Arbitrage Collabbs — deal ${dealId}`,
        metadata: { deal_id: dealId, kind: "admin_release" },
        ...(tx.reference ? { source_transaction: tx.reference } : {}),
      },
      // Le garde-fou d'entrée est `status = "in_escrow"` : si l'écriture qui
      // suit échoue, un second clic transférerait l'argent une deuxième fois.
      { idempotencyKey: `admin-release-${tx.id}` },
    );

    const { error: errTx } = await untyped(admin)
      .from("transactions")
      .update({
        status: "paid",
        escrow_released_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
      })
      .eq("id", tx.id);
    if (errTx) {
      await reportError("admin/release-statut", errTx, {
        detail: `Virement d'arbitrage ${transfer.id} parti pour le deal ${dealId}, transaction ${tx.id} restée « en séquestre ».`,
      });
      back("Le virement est parti mais son enregistrement a échoué. Ne relance pas.", "error");
    }

    await notify({
      userId: tx.creator_id,
      type: "admin_escrow_released",
      title: `${eur(Number(tx.net_amount))} débloqués par Collabbs`,
      body: `Suite à notre arbitrage, les fonds en séquestre t'ont été versés. Motif : ${reason}`,
      link: `/deals/${dealId}`,
    });
    await notify({
      userId: tx.brand_id,
      type: "admin_escrow_released",
      title: "Séquestre débloqué par Collabbs",
      body: `Les fonds ont été versés au créateur suite à notre arbitrage. Motif : ${reason}`,
      link: `/deals/${dealId}`,
    });

    revalidatePath("/admin");
    back(`Séquestre libéré (${transfer.id}).`);
  } catch (err) {
    console.error("[admin] libération impossible", err);
    back("Le virement a été refusé par Stripe.", "error");
  }
}

/** Rend le séquestre à la marque. Usage : le créateur n'a jamais livré. */
export async function adminRefundEscrow(formData: FormData) {
  await requireAdmin();
  if (!stripeConfigured) back("Stripe n'est pas configuré.", "error");

  const dealId = String(formData.get("dealId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!dealId) back("Deal introuvable.", "error");
  if (reason.length < 5) back("Motive ta décision — elle sera consignée.", "error");

  const admin = createAdminClient();
  const { data: tx } = await untyped(admin)
    .from("transactions")
    .select("id, brand_id, creator_id, gross_amount, status, reference")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (!tx) back("Aucun paiement trouvé pour ce deal.", "error");
  if (tx.status !== "in_escrow") back(`Ce paiement n'est pas en séquestre (${tx.status}).`, "error");
  if (!tx.reference) back("Référence de paiement Stripe manquante.", "error");

  try {
    await stripe.refunds.create(
      {
        payment_intent: tx.reference as string,
        metadata: { deal_id: dealId, kind: "admin_refund" },
      },
      { idempotencyKey: `admin-refund-${tx.id}` },
    );

    const { error: errRemb } = await untyped(admin)
      .from("transactions")
      .update({ status: "refunded" })
      .eq("id", tx.id);
    const { error: errDeal } = await untyped(admin)
      .from("deals")
      .update({ status: "cancelled" })
      .eq("id", dealId);
    if (errRemb || errDeal) {
      // Le remboursement est parti chez Stripe. Si nos lignes ne le disent
      // pas, le paiement passe encore pour un séquestre versable.
      await reportError("admin/refund-statut", errRemb ?? errDeal, {
        detail: `Remboursement effectué pour le deal ${dealId} (transaction ${tx.id}) mais nos statuts n'ont pas suivi.`,
      });
      back("Le remboursement est parti mais son enregistrement a échoué. Ne relance pas.", "error");
    }

    await notify({
      userId: tx.brand_id,
      type: "admin_escrow_refunded",
      title: `${eur(Number(tx.gross_amount))} remboursés`,
      body: `Suite à notre arbitrage, les fonds séquestrés t'ont été rendus. Motif : ${reason}`,
      link: `/deals/${dealId}`,
    });
    await notify({
      userId: tx.creator_id,
      type: "admin_escrow_refunded",
      title: "Collaboration close par Collabbs",
      body: `Les fonds ont été rendus à la marque suite à notre arbitrage. Motif : ${reason}`,
      link: `/deals/${dealId}`,
    });

    revalidatePath("/admin");
    back("Séquestre remboursé à la marque.");
  } catch (err) {
    console.error("[admin] remboursement impossible", err);
    back("Le remboursement a été refusé par Stripe.", "error");
  }
}

/**
 * Tranche une contestation d'avantage en nature.
 * `keep` = la déclaration est maintenue (elle recompte dans le cumul).
 */
export async function adminResolveInKind(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const keep = String(formData.get("decision") ?? "") === "keep";
  if (!id) back("Déclaration introuvable.", "error");

  const admin = createAdminClient();
  const { error } = await untyped(admin)
    .from("in_kind_benefits")
    .update({ status: keep ? "declared" : "cancelled" })
    .eq("id", id);
  if (error) back(error.message, "error");

  revalidatePath("/admin");
  revalidatePath("/contracts");
  back(keep ? "Déclaration maintenue dans le cumul." : "Déclaration retirée du cumul.");
}

/** Écarte une vente d'affiliation frauduleuse et rend la réservation à la marque. */
export async function adminRejectSale(formData: FormData) {
  await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!eventId) back("Vente introuvable.", "error");

  const res = await releaseReservation({
    eventId,
    status: "rejected",
    reason: reason || "Écartée par Collabbs",
  });
  if (!res.ok) back(res.message ?? "Impossible d'écarter cette vente.", "error");

  revalidatePath("/admin");
  back("Vente écartée, réservation rendue à la marque.");
}

/**
 * Marque une erreur de production comme traitée.
 *
 * Elle sort de l'écran mais reste en base : on veut pouvoir constater qu'une
 * panne revient après avoir été « traitée ».
 */
export async function resolveError(formData: FormData) {
  await requireAdmin();
  const errorId = String(formData.get("errorId") ?? "");
  if (!errorId) back("Erreur introuvable.", "error");

  const admin = createAdminClient();
  await untyped(admin)
    .from("error_reports")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", errorId);

  revalidatePath("/admin");
  back("Erreur marquée traitée.");
}
