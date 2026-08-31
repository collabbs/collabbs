import "server-only";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBrandCustomer } from "@/lib/affiliate-billing";
import { reportError } from "@/lib/report-error";
import { TARIFS, planValide, type Plan } from "@/lib/tarifs";

/**
 * ─── Pourquoi des formes structurelles plutôt que les types Stripe ───
 * Ce fichier lisait ses objets Stripe en `any`, et c'est très exactement ce
 * qui a coûté un mois d'abonnement : `invoice.subscription` a changé de place
 * dans l'API, personne n'a été prévenu, et le renouvellement sortait en
 * silence.
 *
 * Les types du SDK ne protègent pas mieux — ils décrivent UNE version d'API,
 * et le compte peut en servir une autre. On déclare donc ici ce qu'on LIT
 * réellement, en tolérant l'absence de chaque champ. C'est plus honnête : le
 * type dit « ce champ peut ne pas être là », ce qui est la vérité, au lieu de
 * `any` qui ne dit rien, ou du type Stripe qui affirme une certitude fausse.
 */

/** Ce qu'on lit d'un abonnement Stripe, et rien de plus. */
type AbonnementStripe = {
  id?: string;
  /**
   * A migré vers `items.data[].current_period_end` dans l'API récente. On lit
   * les deux : c'est la même leçon que `identifiantAbonnement` plus bas.
   */
  current_period_end?: number | null;
  items?: { data?: { current_period_end?: number | null }[] } | null;
  metadata?: { brand_id?: string; plan?: string } | null;
};

/** Ce qu'on lit d'une facture Stripe. */
type FactureStripe = {
  subscription?: unknown;
  parent?: { subscription_details?: { subscription?: unknown } | null } | null;
};

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
      // Le seul transtypage du fichier, et il est à la frontière : le SDK
      // décrit une version d'API, le compte peut en servir une autre.
      const sub = (await stripe.subscriptions.retrieve(
        subscriptionId,
      )) as unknown as AbonnementStripe;
      const fin = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
      if (fin) expiresAt = new Date(fin * 1000).toISOString();
    } catch (e) {
      // Sans échéance, le plan resterait actif indéfiniment : on le signale
      // plutôt que de laisser passer un abonnement sans terme.
      await reportError("abonnement/echeance", e, { userId: brandId });
    }
  }

  const admin = createAdminClient();
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
/**
 * Retrouve l'abonnement d'une facture, quelle que soit la forme de l'objet.
 *
 * ⚠️ `invoice.subscription` A DISPARU du premier niveau dans l'API Stripe
 * actuelle : l'identifiant vit désormais dans
 * `parent.subscription_details.subscription`. Le code ne lisait que l'ancien
 * champ, donc `invoice.paid` ne trouvait plus rien et sortait en silence — le
 * webhook répondait 200, et l'échéance ne reculait jamais. La marque payait
 * 99 € par mois pour retomber au tarif gratuit dès le deuxième, exactement ce
 * que le commentaire au-dessus prétendait empêcher.
 *
 * On lit donc les DEUX formes : l'ancienne pour les comptes encore sur une
 * version d'API antérieure, la nouvelle pour tous les autres.
 */
export function identifiantAbonnement(invoice: {
  subscription?: unknown;
  parent?: { subscription_details?: { subscription?: unknown } | null } | null;
}): string | null {
  const candidats = [
    invoice.subscription,
    invoice.parent?.subscription_details?.subscription,
  ];
  for (const c of candidats) {
    if (typeof c === "string" && c) return c;
    if (c && typeof c === "object" && typeof (c as { id?: unknown }).id === "string")
      return (c as { id: string }).id;
  }
  return null;
}

export async function prolongerAbonnement(invoice: FactureStripe): Promise<{ ok: boolean }> {
  const subscriptionId = identifiantAbonnement(invoice);
  if (!subscriptionId) return { ok: false };

  let sub: AbonnementStripe;
  try {
    sub = (await stripe.subscriptions.retrieve(
      subscriptionId,
    )) as unknown as AbonnementStripe;
  } catch (e) {
    await reportError("abonnement/prolongation", e, { detail: subscriptionId });
    return { ok: false };
  }

  const admin = createAdminClient();

  // Les métadonnées de l'abonnement sont la source normale — le Checkout les
  // pose. Mais un abonnement créé depuis le tableau de bord Stripe, repris
  // d'une migration ou touché à la main n'en a pas, et la marque deviendrait
  // alors introuvable pour toujours. Notre propre colonne sait répondre.
  let brandId: string | undefined = sub.metadata?.brand_id;
  let plan = planValide(sub.metadata?.plan);
  if (!brandId) {
    const { data: marque } = await admin
      .from("brands")
      .select("id, plan")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (marque) {
      brandId = marque.id;
      // Sans métadonnée de plan, on reconduit celui déjà en place : c'est ce
      // que la marque paie, et on ne le devine pas à la hausse.
      plan = planValide(marque.plan);
    }
  }
  if (!brandId || plan === "free") return { ok: false };

  const fin = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
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
export async function cloturerAbonnement(sub: AbonnementStripe): Promise<{ ok: boolean }> {
  const admin = createAdminClient();

  // Même repli qu'à la prolongation, et il compte davantage ici : sans lui,
  // une résiliation dont l'abonnement n'a pas de métadonnée laisserait la
  // marque sur un plan payant pour toujours — nous lui offririons un tarif
  // qu'elle ne règle plus.
  let brandId: string | undefined = sub.metadata?.brand_id;
  if (!brandId && sub.id) {
    const { data: marque } = await admin
      .from("brands")
      .select("id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();
    brandId = marque?.id;
  }
  if (!brandId) return { ok: false };
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
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_brand_plans");
  if (error) {
    await reportError("abonnement/expiration", error);
    return 0;
  }
  return Number(data ?? 0);
}
