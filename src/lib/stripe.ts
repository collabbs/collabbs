import "server-only";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { dealBreakdown } from "@/lib/deal";

// Client Stripe côté serveur uniquement (compte Collabbs, mode test pour l'instant).
// La clé secrète ne doit JAMAIS être exposée au navigateur.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

/**
 * Idempotent : enregistre la transaction `in_escrow` pour ce Checkout Session
 * si elle n'existe pas déjà. Utilisé par la route de retour ET par le webhook,
 * pour qu'on n'oublie jamais un paiement même si le navigateur ferme l'onglet.
 */
export async function ensureCheckoutSessionRecorded(
  session: Stripe.Checkout.Session,
): Promise<{ ok: boolean; dealId?: string; already?: boolean }> {
  if (session.payment_status !== "paid") return { ok: false };
  const dealId = session.metadata?.deal_id;
  if (!dealId) return { ok: false };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("transactions")
    .select("id")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (existing) return { ok: true, dealId, already: true };

  const { data: deal } = await admin
    .from("deals")
    .select("brand_id, creator_id, amount")
    .eq("id", dealId)
    .single();
  if (!deal) return { ok: false };

  const b = dealBreakdown(deal.amount);
  await admin.from("transactions").insert({
    type: "deal_payment",
    deal_id: dealId,
    brand_id: deal.brand_id,
    creator_id: deal.creator_id,
    gross_amount: b.gross,
    platform_fee_rate: 0.1,
    platform_fee: b.fee,
    net_amount: b.net,
    currency: "eur",
    status: "in_escrow",
    reference:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  });
  return { ok: true, dealId };
}

/**
 * Synchronise un remboursement Stripe avec notre table `transactions`.
 * Si la transaction est encore en séquestre → marque "refunded". Si elle a
 * déjà été versée (released/paid), on ne touche pas (clawback hors MVP).
 */
export async function handleChargeRefunded(
  charge: Stripe.Charge,
): Promise<{ ok: boolean; updated?: boolean }> {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!pi) return { ok: false };

  const admin = createAdminClient();
  const { data: tx } = await admin
    .from("transactions")
    .select("id, status")
    .eq("reference", pi)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (!tx) return { ok: false };
  if (tx.status !== "in_escrow") return { ok: true, updated: false };

  await admin.from("transactions").update({ status: "refunded" }).eq("id", tx.id);
  return { ok: true, updated: true };
}
