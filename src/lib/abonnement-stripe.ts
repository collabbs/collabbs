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

/**
 * La fin de la période payée, quelle que soit la version d'API servie.
 *
 * Le champ a migré de la racine vers `items.data[].current_period_end`. On lit
 * les deux, et on renvoie `null` plutôt que d'inventer une date : une échéance
 * fausse ferait rétrograder une marque qui paie, ou l'inverse.
 */
export function finDePeriode(sub: {
  current_period_end?: number | null;
  items?: { data?: { current_period_end?: number | null }[] } | null;
}): string | null {
  const fin = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return fin ? new Date(fin * 1000).toISOString() : null;
}

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
      expiresAt = finDePeriode(sub);
    } catch (e) {
      // Sans échéance, le plan resterait actif indéfiniment : on le signale
      // plutôt que de laisser passer un abonnement sans terme.
      await reportError("abonnement/echeance", e, { userId: brandId });
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("brands")
    .update({
      plan,
      stripe_subscription_id: subscriptionId,
      plan_expires_at: expiresAt,
      // Souscrire efface une sortie programmée : on ne peut pas être à la
      // fois en train de partir et de revenir.
      plan_cancel_at: null,
    })
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

  const { error } = await admin
    .from("brands")
    .update({
      plan,
      stripe_subscription_id: subscriptionId,
      plan_expires_at: finDePeriode(sub),
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
    .update({
      plan: "free",
      stripe_subscription_id: null,
      plan_expires_at: null,
      plan_cancel_at: null,
    })
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

/* ══════════════════════════════════════════════════════ résilier, revenir ══

   Ce que la marque demande en cliquant sur « Arrêter mon abonnement », ce
   n'est pas « coupe tout de suite » : c'est « ne me reprends plus rien ». Les
   deux se confondent facilement dans le code, et les confondre revient à lui
   retirer un mois qu'elle a déjà payé.

   On programme donc la fin au terme de la période en cours. Jusque-là, son
   taux ne bouge pas, ses campagnes non plus, et elle peut revenir sur sa
   décision sans repayer. C'est Stripe qui enverra `subscription.deleted` le
   jour venu, et `cloturerAbonnement` la ramènera au tarif gratuit.            */

/**
 * Programme l'arrêt de l'abonnement à la fin de la période réglée.
 *
 * Le cas sans abonnement Stripe n'est pas une erreur : un plan posé à la main
 * (compte de test, geste commercial) n'a rien à annuler chez Stripe. On le
 * ramène alors directement au tarif gratuit — refuser laisserait la marque
 * devant un bouton qui ne fait rien.
 */
export async function resilierAbonnement(
  brandId: string,
): Promise<{ ok: boolean; finLe?: string | null; error?: string }> {
  const admin = createAdminClient();
  const { data: marque } = await admin
    .from("brands")
    .select("plan, stripe_subscription_id, plan_expires_at")
    .eq("id", brandId)
    .maybeSingle();

  if (!marque || planValide(marque.plan) === "free") {
    return { ok: false, error: "Tu n'as pas d'abonnement en cours." };
  }

  if (!marque.stripe_subscription_id) {
    const { error } = await admin
      .from("brands")
      .update({ plan: "free", plan_expires_at: null, plan_cancel_at: null })
      .eq("id", brandId);
    if (error) {
      await reportError("abonnement/resiliation-directe", error, { userId: brandId });
      return { ok: false, error: "La résiliation n'a pas pu être enregistrée. Réessaie." };
    }
    return { ok: true, finLe: null };
  }

  let finLe: string | null = null;
  try {
    const sub = (await stripe.subscriptions.update(marque.stripe_subscription_id, {
      cancel_at_period_end: true,
    })) as unknown as AbonnementStripe;
    finLe = finDePeriode(sub);
  } catch (e) {
    await reportError("abonnement/resiliation", e, { userId: brandId });
    return { ok: false, error: "Stripe n'a pas pu enregistrer la résiliation. Réessaie." };
  }

  // Le repli sur l'échéance connue compte : sans date, l'écran dirait « ton
  // abonnement s'arrête » sans dire quand, ce qui est plus inquiétant que
  // rassurant pour quelqu'un qui vient de cliquer.
  const { error } = await admin
    .from("brands")
    .update({ plan_cancel_at: finLe ?? marque.plan_expires_at })
    .eq("id", brandId);
  if (error) {
    // Stripe a bien enregistré l'arrêt : la marque ne sera pas prélevée. Seul
    // l'affichage est en retard, on le signale sans lui annoncer un échec.
    await reportError("abonnement/resiliation-ecriture", error, { userId: brandId });
  }
  return { ok: true, finLe: finLe ?? marque.plan_expires_at };
}

/** Annule une résiliation programmée : l'abonnement reprend son cours. */
export async function reprendreAbonnement(
  brandId: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: marque } = await admin
    .from("brands")
    .select("stripe_subscription_id")
    .eq("id", brandId)
    .maybeSingle();

  if (!marque?.stripe_subscription_id) {
    return { ok: false, error: "Aucun abonnement à reprendre." };
  }

  try {
    await stripe.subscriptions.update(marque.stripe_subscription_id, {
      cancel_at_period_end: false,
    });
  } catch (e) {
    await reportError("abonnement/reprise", e, { userId: brandId });
    return { ok: false, error: "Stripe n'a pas pu reprendre l'abonnement. Réessaie." };
  }

  const { error } = await admin
    .from("brands")
    .update({ plan_cancel_at: null })
    .eq("id", brandId);
  if (error) {
    await reportError("abonnement/reprise-ecriture", error, { userId: brandId });
    return { ok: false, error: "La reprise n'a pas pu être enregistrée. Réessaie." };
  }
  return { ok: true };
}
