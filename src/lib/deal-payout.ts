import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { notify } from "@/lib/notifications";
import { reportError } from "@/lib/report-error";

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
export type PayoutReason =
  /** Le créateur n'a pas encore de compte de paiement. */
  | "no_account"
  /** Il en a un, mais Stripe ne l'autorise pas encore à recevoir. */
  | "account_not_ready"
  /** Tout autre échec : Stripe, provision, état incohérent. */
  | "other";

export async function attemptDealPayout(
  dealId: string,
): Promise<{ released: boolean; error?: string; reason?: PayoutReason }> {
  if (!stripeConfigured) return { released: false, reason: "other", error: "Stripe non configuré." };
  const admin = createAdminClient();

  const { data: deal } = await admin
    .from("deals")
    .select("creator_id, status, perf_rate, perf_validated_at")
    .eq("id", dealId)
    .single();
  if (!deal || deal.status !== "completed")
    return { released: false, reason: "other", error: "Le deal n'est pas terminé." };

  // Point de passage OBLIGÉ des versements — le bouton de la marque comme
  // l'automate de délais entrent par ici. C'est donc le seul endroit où placer
  // ce garde-fou : sur une collaboration payée aux vues, le séquestre vaut le
  // PLAFOND. Le verser sans validation reviendrait à payer le maximum pour un
  // contenu qui n'a peut-être fait que le dixième des vues, et la marque
  // n'aurait aucun recours : l'argent serait parti.
  if (deal.perf_rate != null && !deal.perf_validated_at)
    return {
      released: false,
      reason: "other",
      error:
        "Les vues n'ont pas encore été validées. Tant qu'elles ne le sont pas, le montant dû n'est pas fixé et le séquestre vaut le plafond.",
    };

  const { data: tx } = await admin
    .from("transactions")
    .select("id, net_amount, status, reference")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (!tx) return { released: false, reason: "other", error: "Aucun paiement en séquestre." };
  if (tx.status === "released" || tx.status === "paid") return { released: true };
  // Zéro vue validée : tout le plafond est déjà reparti chez la marque et la
  // transaction a été soldée. Il n'y a rien à verser — et surtout pas d'erreur
  // à afficher, la collaboration s'est déroulée normalement.
  if (tx.status === "refunded" && Number(tx.net_amount) === 0) return { released: true };
  if (tx.status !== "in_escrow")
    return { released: false, reason: "other", error: "Ce paiement ne peut pas être versé." };

  const { data: cr } = await admin
    .from("creators")
    .select("stripe_account_id")
    .eq("id", deal.creator_id)
    .single();
  if (!cr?.stripe_account_id)
    return {
      released: false,
      reason: "no_account",
      error: "Le créateur n'a pas encore connecté son compte.",
    };

  try {
    const account = await stripe.accounts.retrieve(cr.stripe_account_id);
    if (account.capabilities?.transfers !== "active")
      return {
        released: false,
        reason: "account_not_ready",
        error: "Le compte du créateur n'est pas encore prêt à recevoir.",
      };

    let sourceCharge: string | undefined;
    if (tx.reference) {
      const pi = await stripe.paymentIntents.retrieve(tx.reference);
      sourceCharge =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : (pi.latest_charge?.id ?? undefined);
    }

    // Clé d'idempotence : c'est le seul rempart contre un VERSEMENT EN DOUBLE.
    // Le garde-fou d'entrée repose sur `status = "in_escrow"` ; si l'écriture
    // qui suit le transfert échoue, le statut reste "in_escrow" et la prochaine
    // tentative — l'automate de délais tourne tous les jours — repasserait ici
    // et transférerait une seconde fois de l'argent réel. Avec cette clé,
    // Stripe renvoie le transfert déjà créé au lieu d'en créer un autre.
    await stripe.transfers.create(
      {
        amount: Math.round(Number(tx.net_amount) * 100),
        currency: "eur",
        destination: cr.stripe_account_id,
        ...(sourceCharge ? { source_transaction: sourceCharge } : {}),
        metadata: { deal_id: dealId },
      },
      { idempotencyKey: `deal-payout-${tx.id}` },
    );

    const { error: errStatut } = await admin
      .from("transactions")
      .update({ status: "released", escrow_released_at: new Date().toISOString() })
      .eq("id", tx.id);
    if (errStatut) {
      // L'argent est PARTI et notre trace dit encore « en séquestre ». Le
      // transfert ne se refera pas (clé d'idempotence ci-dessus), mais il faut
      // que quelqu'un le sache : sans ça, le créateur est payé et le produit
      // l'ignore.
      await reportError("deal/payout-statut", errStatut, {
        detail: `Transfert Stripe effectué pour le deal ${dealId} (transaction ${tx.id}), mais le statut n'a pas pu passer à "released".`,
      });
      return {
        released: false,
        reason: "other",
        error:
          "Le virement est parti, mais son enregistrement a échoué. Ne relance pas : contacte le support avec la référence du deal.",
      };
    }

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
    return {
      released: false,
      reason: "other",
      error: e instanceof Error ? e.message : "Échec du versement.",
    };
  }
}

