import "server-only";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBrandCustomer } from "@/lib/affiliate-billing";
import { reportError } from "@/lib/report-error";
import { TARIFS, planValide, type Plan } from "@/lib/tarifs";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Souscription et gestion d'un abonnement de marque.
 *
 * Le prix est créé à la volée depuis `lib/tarifs` plutôt que référencé par un
 * identifiant de tarif Stripe : la grille reste ainsi une seule source de
 * vérité, et changer un prix ne demande pas de le changer à deux endroits.
 */

/** Ouvre le paiement d'un abonnement mensuel. Renvoie l'URL Stripe. */
export async function ouvrirAbonnement(params: {
  brandId: string;
  plan: Exclude<Plan, "free">;
  origin: string;
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  const tarif = TARIFS[params.plan];
  try {
    const customerId = await ensureBrandCustomer(params.brandId);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(tarif.prix * 100),
            recurring: { interval: "month" },
            product_data: {
              name: `Collabbs ${tarif.libelle}`,
              description: `Commission ramenée à ${Math.round(tarif.tauxCollab * 100)} % sur les collaborations et ${Math.round(tarif.tauxAffiliation * 100)} % sur l'affiliation.`,
            },
          },
        },
      ],
      // Le plan visé voyage avec la session : le retour et le webhook le
      // relisent au lieu de le deviner.
      metadata: { brand_id: params.brandId, kind: "abonnement", plan: params.plan },
      subscription_data: {
        metadata: { brand_id: params.brandId, plan: params.plan },
      },
      success_url: `${params.origin}/billing?abonnement=1`,
      cancel_url: `${params.origin}/billing?abonnement=annule`,
    });
    return session.url ? { ok: true, url: session.url } : { ok: false, error: "Stripe n'a pas renvoyé d'URL." };
  } catch (e) {
    await reportError("abonnement/ouverture", e, { userId: params.brandId });
    return { ok: false, error: "L'abonnement n'a pas pu être ouvert. Réessaie." };
  }
}

/**
 * Enregistre l'abonnement après paiement.
 *
 * Appelé par le webhook ET par le retour de navigation, comme pour le
 * séquestre : si l'utilisateur ferme l'onglet, le webhook rattrape ; si le
 * webhook tarde, le retour a déjà fait le travail. Idempotent par nature —
 * écrire deux fois le même plan ne change rien.
 */
export async function enregistrerAbonnement(session: {
  metadata?: Record<string, string> | null;
  subscription?: string | { id: string } | null;
}): Promise<{ ok: boolean }> {
  const brandId = session.metadata?.brand_id;
  const plan = planValide(session.metadata?.plan);
  if (!brandId || plan === "free") return { ok: false };

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);

  // L'échéance vient de Stripe, jamais d'un calcul local : c'est lui qui sait
  // jusqu'à quand la période est payée.
  let expiresAt: string | null = null;
  if (subscriptionId) {
    try {
      const sub: any = await stripe.subscriptions.retrieve(subscriptionId);
      const fin = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
      if (fin) expiresAt = new Date(fin * 1000).toISOString();
    } catch (e) {
      // Sans échéance, le plan resterait actif indéfiniment : on le signale
      // plutôt que de laisser passer un abonnement sans terme.
      await reportError("abonnement/echeance", e, { userId: brandId });
    }
  }

  const admin: any = createAdminClient();
  const { error } = await admin
    .from("brands")
    .update({ plan, stripe_subscription_id: subscriptionId, plan_expires_at: expiresAt })
    .eq("id", brandId);
  if (error) {
    // La marque a payé et son taux n'a pas changé : c'est de l'argent encaissé
    // sans contrepartie. Ça ne doit pas rester invisible.
    await reportError("abonnement/enregistrement", error, {
      userId: brandId,
      detail: `Abonnement ${plan} payé (${subscriptionId ?? "sans id"}) mais plan non appliqué.`,
    });
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Renouvellement mensuel : l'échéance recule.
 *
 * Sans cet évènement, le plan expirerait à la fin du premier mois payé alors
 * que la marque continue de régler — elle paierait 99 € pour retomber au
 * tarif gratuit.
 */
export async function prolongerAbonnement(invoice: any): Promise<{ ok: boolean }> {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription?.id ?? null);
  if (!subscriptionId) return { ok: false };

  let sub: any;
  try {
    sub = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (e) {
    await reportError("abonnement/prolongation", e, { detail: subscriptionId });
    return { ok: false };
  }

  const brandId = sub.metadata?.brand_id;
  const plan = planValide(sub.metadata?.plan);
  if (!brandId || plan === "free") return { ok: false };

  const fin = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  const admin: any = createAdminClient();
  const { error } = await admin
    .from("brands")
    .update({
      plan,
      stripe_subscription_id: subscriptionId,
      plan_expires_at: fin ? new Date(fin * 1000).toISOString() : null,
    })
    .eq("id", brandId);
  if (error) {
    await reportError("abonnement/prolongation-ecriture", error, { userId: brandId });
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Fin d'abonnement : retour au tarif gratuit.
 *
 * On ne rétrograde pas au-delà de ce qui est déjà payé — Stripe n'envoie cet
 * évènement qu'au terme de la période réglée.
 */
export async function cloturerAbonnement(sub: any): Promise<{ ok: boolean }> {
  const brandId = sub.metadata?.brand_id;
  if (!brandId) return { ok: false };
  const admin: any = createAdminClient();
  const { error } = await admin
    .from("brands")
    .update({ plan: "free", stripe_subscription_id: null, plan_expires_at: null })
    .eq("id", brandId);
  if (error) {
    await reportError("abonnement/cloture", error, { userId: brandId });
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Filet quotidien : rétrograde les abonnements dont l'échéance est passée.
 *
 * `planDeLaMarque` traite déjà le cas à la lecture — un plan échu est calculé
 * comme gratuit. Cette passe fait le ménage en base pour que les écrans
 * d'administration et les statistiques disent la même chose que le calcul.
 */
export async function expirerAbonnementsEchus(): Promise<number> {
  const admin: any = createAdminClient();
  const { data, error } = await admin.rpc("expire_brand_plans");
  if (error) {
    await reportError("abonnement/expiration", error);
    return 0;
  }
  return Number(data ?? 0);
}
