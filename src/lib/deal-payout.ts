import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { notify } from "@/lib/notifications";

/**
 * Versement de la part créateur d'un séquestre.
 *
 * Extrait des actions serveur pour être partagé avec l'automate de délais :
 * un versement déclenché par le SLA doit emprunter exactement le même chemin
 * qu'un versement déclenché à la main. Deux implémentations d'un mouvement
 * d'argent finiraient par diverger.
 */
/**
 * Verse au créateur sa part (net) du séquestre vers son compte connecté.
 * Utilise `source_transaction` (le paiement de la marque) pour autoriser le
 * transfert même si le solde disponible n'est pas encore consolidé.
 * Renvoie le détail pour pouvoir afficher l'erreur réelle au besoin.
 */
export async function attemptDealPayout(
  dealId: string,
): Promise<{ released: boolean; error?: string }> {
  if (!stripeConfigured) return { released: false, error: "Stripe non configuré." };
  const admin = createAdminClient();

  const { data: deal } = await admin
    .from("deals")
    .select("creator_id, status")
    .eq("id", dealId)
    .single();
  if (!deal || deal.status !== "completed")
    return { released: false, error: "Le deal n'est pas terminé." };

  const { data: tx } = await admin
    .from("transactions")
    .select("id, net_amount, status, reference")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (!tx) return { released: false, error: "Aucun paiement en séquestre." };
  if (tx.status === "released" || tx.status === "paid") return { released: true };
  if (tx.status !== "in_escrow")
    return { released: false, error: "Ce paiement ne peut pas être versé." };

  const { data: cr } = await admin
    .from("creators")
    .select("stripe_account_id")
    .eq("id", deal.creator_id)
    .single();
  if (!cr?.stripe_account_id)
    return { released: false, error: "Le créateur n'a pas encore connecté son compte." };

  try {
    const account = await stripe.accounts.retrieve(cr.stripe_account_id);
    if (account.capabilities?.transfers !== "active")
      return { released: false, error: "Le compte du créateur n'est pas encore prêt à recevoir." };

    let sourceCharge: string | undefined;
    if (tx.reference) {
      const pi = await stripe.paymentIntents.retrieve(tx.reference);
      sourceCharge =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : (pi.latest_charge?.id ?? undefined);
    }

    await stripe.transfers.create({
      amount: Math.round(Number(tx.net_amount) * 100),
      currency: "eur",
      destination: cr.stripe_account_id,
      ...(sourceCharge ? { source_transaction: sourceCharge } : {}),
      metadata: { deal_id: dealId },
    });
    await admin
      .from("transactions")
      .update({ status: "released", escrow_released_at: new Date().toISOString() })
      .eq("id", tx.id);

    // Notif "tu as reçu X€" au créateur.
    await notify({
      userId: deal.creator_id,
      type: "payment_received_creator",
      title: `Tu viens de recevoir ${Number(tx.net_amount).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} 💸`,
      body: "Le versement a été transféré sur ton compte Stripe connecté. Selon ton calendrier de payout, il atterrira sur ton compte bancaire dans les prochains jours.",
      link: "/payouts",
    });

    return { released: true };
  } catch (e) {
    return { released: false, error: e instanceof Error ? e.message : "Échec du versement." };
  }
}

