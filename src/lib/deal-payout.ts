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
  /**
   * Notre trace dit « payé et séquestré », mais le paiement correspondant est
   * introuvable chez Stripe. On ne verse pas : il faut un humain.
   */
  | "paiement_introuvable"
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

    // ─── Le paiement d'origine ───
    //
    // `source_transaction` rattache le virement au paiement de la marque : il
    // autorise le transfert avant que le solde ne soit consolidé. C'est un
    // confort, pas une obligation — un séquestre sans référence se verse
    // depuis le solde de la plateforme.
    //
    // MAIS : une référence PRÉSENTE et INTROUVABLE n'est pas la même chose
    // qu'une référence absente. C'est une incohérence — notre base affirme
    // qu'une marque a payé, et Stripe ne connaît pas ce paiement. C'est
    // exactement l'état des 1 260 € restés bloqués depuis le 30 août : une
    // référence de test dans une base branchée sur le compte réel.
    //
    // Dans ce cas on ne verse SURTOUT pas. Verser quand même reviendrait à
    // payer un créateur avec l'argent de Collabbs pour une somme peut-être
    // jamais encaissée. On s'arrête, et on le dit — c'est ce silence-là qui a
    // laissé la situation durer dix jours.
    let sourceCharge: string | undefined;
    if (tx.reference) {
      try {
        const pi = await stripe.paymentIntents.retrieve(tx.reference);
        sourceCharge =
          typeof pi.latest_charge === "string"
            ? pi.latest_charge
            : (pi.latest_charge?.id ?? undefined);
      } catch (e) {
        await reportError("deal/paiement-introuvable", e, {
          detail:
            `La transaction ${tx.id} (deal ${dealId}) porte la référence « ${tx.reference} », ` +
            `que Stripe ne connaît pas. Le versement est refusé tant que personne n'a tranché : ` +
            `soit le paiement existe sous une autre référence, soit il n'a jamais eu lieu.`,
        });
        return {
          released: false,
          reason: "paiement_introuvable",
          error:
            "Le paiement d'origine est introuvable chez Stripe. Le versement est suspendu : " +
            "contacte le support avec la référence de la collaboration.",
        };
      }
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

