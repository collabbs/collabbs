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
import { alerterAdmins } from "@/lib/alerte-admin";

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

  // `.trim()` n'est pas de la coquetterie : un secret collé depuis le tableau
  // de bord Stripe emporte très facilement un retour à la ligne ou une espace.
  // À l'écran la valeur paraît juste — on relit « whsec_… » et tout va bien —
  // mais la signature calculée diffère, et Stripe ne répond qu'un 401 nu.
  // Deux heures perdues le 07/10/2026 à soupçonner la mauvaise clé.
  const brut = process.env.STRIPE_WEBHOOK_SECRET;
  const webhookSecret = brut?.trim();
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
    // Le 401 reste nu pour l'appelant : il est public, et une réponse qui
    // décrit la configuration du serveur n'a rien à y faire. Les éléments
    // qui permettent de trancher partent dans les journaux Vercel, où seul
    // Julien les lit. Aucun ne permet de reconstituer le secret.
    //
    // Ils ne sont pas décoratifs : le 07/10/2026, un 401 sans explication a
    // coûté une demi-journée et trois hypothèses fausses. La vraie cause —
    // deux variables Vercel homonymes, l'une sur Preview et l'autre sur
    // Production — n'a été trouvée qu'en faisant parler le code.
    /* Cinq jours de 401 sans que personne le sache, du 07 au 12/10/2026 : la
       route de retour créditait la provision à la place du webhook, donc rien
       n'avait l'air cassé. Un client qui ferme son onglet avant la
       redirection, lui, aurait payé sans rien recevoir. On pousse l'alerte au
       lieu de l'écrire dans une table qu'il faut penser à ouvrir. */
    await alerterAdmins({
      type: "webhook_stripe_signature",
      title: "Le webhook Stripe refuse les signatures",
      body: "Stripe nous envoie des évènements que nous rejetons : STRIPE_WEBHOOK_SECRET ne correspond pas à la destination active. Les paiements continuent d'être encaissés, mais un client qui ferme son onglet avant d'être redirigé ne verra pas sa provision créditée. Vérifier la variable sur Vercel — attention, il peut en exister une par environnement.",
      link: "/admin",
    });
    console.error("[stripe/webhook] signature refusee", {
      longueur_du_secret: webhookSecret.length,
      prefixe_whsec: webhookSecret.startsWith("whsec_"),
      espaces_parasites: brut !== webhookSecret,
      taille_du_corps: rawBody.length,
      horodatage_signature: /^t=\d+/.test(sig),
      deploiement: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "inconnu",
    });
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
