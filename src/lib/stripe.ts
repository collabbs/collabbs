import "server-only";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
/* `eurExact` et non `eur` : ici l'argent a bougé ou il est dû, donc il
   s'écrit au centime. La règle est posée dans `lib/deal.ts` — `eur` reste pour
   les tarifs affichés, où « 300€ » se lit mieux que « 300,00€ ». Les écrans
   d'argent (provision, registre, versements, factures) la respectaient déjà ;
   les notifications sur ce MÊME argent, non. Un versement de 7,20 € s'annonçait
   « 7,2€ » puis se relisait « 7,20€ » dans le registre. */
import { dealBreakdown, eurExact as eur } from "@/lib/deal";
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
  /* ═══ UNE CLÉ « LIVE » NE TOURNE PAS EN DÉVELOPPEMENT ═══

     `.env.development.local` ne redéfinit que Supabase. Tout le reste — dont
     cette clé — est donc hérité de `.env.local`, qui porte les valeurs de
     production. Constaté le 22/10/2026 : le serveur local tournait avec la clé
     Stripe du projet réel. Elle était en mode test, donc rien n'a été risqué ;
     mais le jour où une clé `sk_live_` y atterrit, un essai local déplace de
     l'argent réel sans que rien ne le signale.

     On refuse donc explicitement. En production `NODE_ENV` vaut
     « production » et ce garde ne s'applique jamais : il ne peut rien casser
     de légitime, et il rend impossible la seule erreur qu'on ne pourrait pas
     défaire. */
  if (key.includes("_live_") && process.env.NODE_ENV !== "production") {
    throw new Error(
      "Refus de démarrer : STRIPE_SECRET_KEY est une clé LIVE et nous ne sommes " +
        "pas en production. Un essai local déplacerait de l'argent réel. Mets une " +
        "clé sk_test_… dans .env.development.local.",
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

  /* ─── Et le créateur ───
     Mesuré le 22/10/2026 en parcourant le produit : seule la marque était
     avertie. Or l'étape qui suit s'appelle « En attente du créateur » — c'est
     lui qui doit agir, et c'était lui qu'on laissait dans le noir.

     Ce n'est pas un détail de confort. Le séquestre EST la promesse de
     Collabbs : « l'argent est bloqué, tu peux produire sereinement ». Tant que
     le créateur l'ignore, soit il ne commence pas, soit il travaille sans
     savoir qu'il est couvert — et dans les deux cas la garantie qu'on vend ne
     lui sert à rien.

     On lui annonce le NET : c'est ce qu'il touchera, la commission étant à la
     charge de la marque. Lui montrer les 66 € encaissés laisserait croire à
     une retenue au moment du versement. */
  await notify({
    userId: deal.creator_id,
    type: "payment_received_creator",
    title: `${eur(b.net)} sont sécurisés pour toi`,
    body: `La marque a payé : les fonds sont bloqués chez Collabbs jusqu'à ta livraison. Tu peux produire le contenu, tu seras payé à la validation.`,
    link: `/deals/${dealId}`,
  });

  return { ok: true, dealId };
}

/**
 * Synchronise un remboursement Stripe avec notre table `transactions`.
 * Si la transaction est encore en séquestre → marque "refunded". Si elle a
 * déjà été versée (released/paid), on ne touche pas (clawback hors MVP).
 *
 * ⚠️ **Seul un remboursement TOTAL solde le séquestre.** Les collaborations
 * payées aux vues remboursent volontairement une partie du plafond — le
 * reliquat entre le maximum séquestré et les vues réellement faites. Traiter
 * ce remboursement partiel comme un solde ferait passer la transaction à
 * "refunded" et le créateur ne serait JAMAIS payé, alors que l'argent qui lui
 * revient est toujours là. `charge.refunded` ne vaut `true` que lorsque la
 * totalité a été rendue : c'est exactement la question qu'on pose ici.
 */
export async function handleChargeRefunded(
  charge: Stripe.Charge,
): Promise<{ ok: boolean; updated?: boolean }> {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!pi) return { ok: false };
  if (!charge.refunded) return { ok: true, updated: false };

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
