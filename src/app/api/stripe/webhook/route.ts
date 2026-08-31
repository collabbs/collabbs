import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  stripe,
  stripeConfigured,
  ensureCheckoutSessionRecorded,
  handleChargeRefunded,
} from "@/lib/stripe";
import { handleTopupCheckout } from "@/lib/affiliate-billing";
import {
  enregistrerAbonnement,
  prolongerAbonnement,
  cloturerAbonnement,
} from "@/lib/abonnement-stripe";
import { reportError } from "@/lib/report-error";

// Webhook Stripe — source de vérité asynchrone pour les événements de paiement.
// Sécurité : la signature Stripe est vérifiée avec STRIPE_WEBHOOK_SECRET (sinon 401).
// On retourne 200 dès qu'on a reçu l'événement, même si on l'a ignoré, pour ne pas
// faire retenter Stripe inutilement.
//
// Évènements gérés :
//  - checkout.session.completed  → enregistre la transaction in_escrow (idempotent)
//  - charge.refunded             → marque la transaction comme refunded
export async function POST(request: Request) {
  if (!stripeConfigured) {
    return NextResponse.json({ ok: false, error: "stripe non configuré" }, { status: 500 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "STRIPE_WEBHOOK_SECRET manquant" },
      { status: 500 },
    );
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ ok: false, error: "signature manquante" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch {
    return NextResponse.json({ ok: false, error: "signature invalide" }, { status: 401 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Trois natures de paiement transitent par Checkout : le règlement
        // d'un deal (séquestre), l'approvisionnement d'une provision
        // d'affiliation, et l'abonnement mensuel d'une marque.
        if (session.metadata?.kind === "abonnement") {
          await enregistrerAbonnement(session);
        } else if (session.metadata?.kind === "topup") {
          await handleTopupCheckout(session);
        } else {
          await ensureCheckoutSessionRecorded(session);
        }
        break;
      }
      case "charge.refunded": {
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      }
      // Renouvellement mensuel : l'échéance recule d'un mois. Sans cet
      // évènement, le plan expirerait au bout du premier mois payé alors que
      // la marque continue de régler.
      case "invoice.paid": {
        await prolongerAbonnement(event.data.object as Stripe.Invoice);
        break;
      }
      // Résiliation, carte refusée trois fois, fin d'essai : Stripe clôt
      // l'abonnement et la marque retombe au tarif gratuit.
      case "customer.subscription.deleted": {
        await cloturerAbonnement(event.data.object as Stripe.Subscription);
        break;
      }
      // D'autres évènements seront ajoutés ici si besoin (transfer.created, account.updated…)
      default:
        // évènement non géré → 200 quand même, on accuse réception
        break;
    }
  } catch (err) {
    // On renvoie 200 quoi qu'il arrive, pour que Stripe ne retente pas en
    // boucle. Le rattrapage existe : `/api/stripe/return` rappelle la même
    // fonction, idempotente, quand la marque revient du paiement.
    //
    // Mais l'erreur DOIT être visible. Le commentaire disait « on logue (à
    // brancher plus tard) » et le bloc était vide : un séquestre perdu des
    // deux côtés n'aurait laissé aucune trace, alors que la marque a payé.
    await reportError("stripe-webhook", err, {
      detail: `évènement ${event.type} (${event.id})`,
    });
  }

  return NextResponse.json({ ok: true });
}
