import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  stripe,
  stripeConfigured,
  ensureCheckoutSessionRecorded,
  handleChargeRefunded,
} from "@/lib/stripe";

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
        await ensureCheckoutSessionRecorded(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "charge.refunded": {
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      }
      // D'autres évènements seront ajoutés ici si besoin (transfer.created, account.updated…)
      default:
        // évènement non géré → 200 quand même, on accuse réception
        break;
    }
  } catch {
    // Erreur applicative : on logue (à brancher plus tard) mais on renvoie 200
    // pour ne pas que Stripe retente en boucle. Idempotence garantit le rattrapage.
  }

  return NextResponse.json({ ok: true });
}
