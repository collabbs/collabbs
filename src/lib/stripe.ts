import "server-only";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { dealBreakdown, eur } from "@/lib/deal";
import { notify } from "@/lib/notifications";
import { reportError } from "@/lib/report-error";
import { planDeLaMarque } from "@/lib/abonnement";
import { tauxCollab } from "@/lib/tarifs";

// Client Stripe côté serveur uniquement (compte Collabbs, mode test pour l'instant).
// La clé secrète ne doit JAMAIS être exposée au navigateur.
//
// Init paresseux : on n'instancie le SDK qu'au premier appel runtime, sinon
// `next build` collecte les pages côté Vercel SANS la variable d'env et
// le constructeur Stripe crashe ("Neither apiKey nor config.authenticator
// provided"). Avec ce Proxy, le build passe même si la clé est absente —
// l'erreur ne remonte qu'au moment où une route veut vraiment appeler Stripe.
let _stripeInstance: Stripe | null = null;
function getStripeInstance(): Stripe {
  if (_stripeInstance) return _stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY n'est pas configuré. Pose la variable d'env sur Vercel " +
        "(Project → Settings → Environment Variables) puis redéploie.",
    );
  }
  _stripeInstance = new Stripe(key);
  return _stripeInstance;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const instance = getStripeInstance();
    const value = (instance as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

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

  // Le taux appliqué est celui du plan de la marque AU MOMENT DU PAIEMENT.
  // Il est figé dans la transaction : un changement de plan plus tard ne doit
  // pas réécrire ce qui a été encaissé.
  const plan = await planDeLaMarque(deal.brand_id);
  const b = dealBreakdown(deal.amount, plan);
  const { error: errTx } = await admin.from("transactions").insert({
    type: "deal_payment",
    deal_id: dealId,
    brand_id: deal.brand_id,
    creator_id: deal.creator_id,
    gross_amount: b.gross,
    platform_fee_rate: tauxCollab(plan),
    platform_fee: b.fee,
    net_amount: b.net,
    currency: "eur",
    status: "in_escrow",
    reference:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  });
  if (errTx) {
    // La marque a PAYÉ chez Stripe et nous n'en gardons aucune trace : le
    // séquestre serait invisible, le deal bloqué, et le versement au créateur
    // impossible puisqu'il part de cette ligne. Sans ce contrôle, le webhook
    // répondait « ok » et l'argent disparaissait de notre côté.
    await reportError("stripe/checkout-transaction", errTx, {
      detail: `Paiement encaissé pour le deal ${dealId} (référence ${typeof session.payment_intent === "string" ? session.payment_intent : "inconnue"}) mais la transaction n'a pas pu être enregistrée.`,
    });
    // On renvoie un échec : Stripe rejouera le webhook.
    return { ok: false };
  }

  // Reçu de paiement pour la marque.
  await notify({
    userId: deal.brand_id,
    type: "payment_received_brand",
    title: `Paiement de ${eur(b.gross)} bien reçu`,
    body: `Les fonds sont mis en séquestre. Ils seront versés au créateur quand tu auras validé sa livraison et clôturé le deal.`,
    link: `/deals/${dealId}`,
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

  const { error } = await admin
    .from("transactions")
    .update({ status: "refunded" })
    .eq("id", tx.id);
  if (error) {
    // Sans ce passage à "refunded", la transaction reste « en séquestre » alors
    // que la marque a été remboursée : le versement au créateur resterait
    // possible sur de l'argent déjà rendu.
    await reportError("stripe/refund-statut", error, {
      detail: `Remboursement Stripe reçu (${pi}) mais la transaction ${tx.id} n'a pas pu passer à "refunded".`,
    });
    return { ok: false };
  }
  return { ok: true, updated: true };
}
