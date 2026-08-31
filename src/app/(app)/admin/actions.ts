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


function back(msg: string, kind: "ok" | "error" = "ok"): never {
  redirect(`/admin?${kind === "ok" ? "done" : "error"}=${encodeURIComponent(msg)}`);
}

/**
 * Libère le séquestre au bénéfice du créateur, hors du parcours normal.
 * Usage : la marque ne valide jamais alors que la livraison est faite.
 */
/**
 * Prévient quelqu'un, à condition qu'on sache qui.
 *
 * Sur `transactions`, `brand_id` et `creator_id` sont nullables. Un
 * arbitrage qui débloque ou rembourse un séquestre DOIT prévenir les deux
 * parties : si l'identifiant manque, il faut le savoir, pas laisser partir
 * une notification vers personne.
 */
async function prevenir(
  userId: string | null,
  role: "créateur" | "marque",
  contexte: string,
  message: Omit<Parameters<typeof notify>[0], "userId">,
) {
  if (!userId) {
    await reportError("admin/notification-sans-destinataire", new Error(`${role} inconnu`), {
      detail: contexte,
    });
    return;
  }
  await notify({ ...message, userId });
}

export async function adminReleaseEscrow(formData: FormData) {
  await requireAdmin();
  if (!stripeConfigured) back("Stripe n'est pas configuré.", "error");

  const dealId = String(formData.get("dealId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!dealId) back("Deal introuvable.", "error");
  if (reason.length < 5) back("Motive ta décision — elle sera consignée.", "error");

  const admin = createAdminClient();
  const { data: tx } = await admin
    .from("transactions")
    .select("id, deal_id, brand_id, creator_id, net_amount, status, reference")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (!tx) back("Aucun paiement trouvé pour ce deal.", "error");
  if (tx.status !== "in_escrow") back(`Ce paiement n'est pas en séquestre (${tx.status}).`, "error");

  const { data: creator } = await admin
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

    const { error: errTx } = await admin
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

    await prevenir(tx.creator_id, "créateur", `deal ${dealId}, transaction ${tx.id}`, {
      type: "admin_escrow_released",
      title: `${eur(Number(tx.net_amount))} débloqués par Collabbs`,
      body: `Suite à notre arbitrage, les fonds en séquestre t'ont été versés. Motif : ${reason}`,
      link: `/deals/${dealId}`,
    });
    await prevenir(tx.brand_id, "marque", `deal ${dealId}, transaction ${tx.id}`, {
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
  const { data: tx } = await admin
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

    const { error: errRemb } = await admin
      .from("transactions")
      .update({ status: "refunded" })
      .eq("id", tx.id);
    const { error: errDeal } = await admin
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

    await prevenir(tx.brand_id, "marque", `deal ${dealId}, transaction ${tx.id}`, {
      type: "admin_escrow_refunded",
      title: `${eur(Number(tx.gross_amount))} remboursés`,
      body: `Suite à notre arbitrage, les fonds séquestrés t'ont été rendus. Motif : ${reason}`,
      link: `/deals/${dealId}`,
    });
    await prevenir(tx.creator_id, "créateur", `deal ${dealId}, transaction ${tx.id}`, {
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
  const { error } = await admin
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
  await admin
    .from("error_reports")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", errorId);

  revalidatePath("/admin");
  back("Erreur marquée traitée.");
}

/**
 * Régularise la provision d'affiliation d'une marque.
 *
 * Le registre prévoyait la catégorie « adjustment » depuis toujours, et la page
 * de facturation savait l'afficher — mais aucune fonction ne pouvait en écrire
 * une : `credit_balance` refuse les montants négatifs, et toucher
 * `brands.balance` à la main casse la seule règle qui protège le registre.
 *
 * Le montant est SIGNÉ : négatif pour reprendre, positif pour offrir. Le motif
 * est obligatoire — un mouvement d'argent sans raison écrite est indéfendable
 * trois mois plus tard, devant la marque comme devant nous.
 */
export async function adminAdjustProvision(formData: FormData) {
  await requireAdmin();
  const brandId = String(formData.get("brand_id") ?? "").trim();
  const montant = Number(formData.get("amount"));
  const motif = String(formData.get("label") ?? "").trim();

  if (!brandId) back("Marque manquante.", "error");
  if (!Number.isFinite(montant) || montant === 0)
    back("Indique un montant non nul (négatif pour reprendre).", "error");
  if (!motif) back("Le motif est obligatoire : il sera lisible par la marque.", "error");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("adjust_balance", {
    p_brand: brandId,
    p_amount: montant,
    p_label: motif,
  });
  if (error) {
    await reportError("admin/ajustement-provision", error, {
      detail: `marque ${brandId}, montant ${montant}`,
    });
    back(error.message, "error");
  }

  // La marque doit l'apprendre autrement qu'en voyant son solde bouger.
  await notify({
    userId: brandId,
    type: "payment_received_brand",
    title:
      montant > 0
        ? `Régularisation : ${eur(montant)} crédités sur ta provision`
        : `Régularisation : ${eur(Math.abs(montant))} repris sur ta provision`,
    body: motif,
    link: "/billing",
  });

  revalidatePath("/admin");
  revalidatePath("/billing");
  back(`Provision régularisée — nouveau solde ${eur(Number(data ?? 0))}.`);
}
