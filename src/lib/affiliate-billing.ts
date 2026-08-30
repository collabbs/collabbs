import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { notify } from "@/lib/notifications";
import { reportError } from "@/lib/report-error";

/**
 * Circuit d'argent de l'affiliation.
 *
 * Rappel du modèle (décidé le 29/08/2026) :
 *  - la marque dépose une PROVISION (carte enregistrée, recharge auto sous seuil) ;
 *  - chaque vente réserve immédiatement sur cette provision la commission du
 *    créateur PLUS les frais Collabbs — donc le créateur est garanti dès la vente ;
 *  - les frais Collabbs sont payés PAR LA MARQUE EN PLUS : le créateur touche
 *    exactement le taux annoncé par la campagne ;
 *  - après 30 jours sans remboursement la vente est validée, puis versée au
 *    créateur lors du versement mensuel (minimum 20 €).
 *
 * Toute variation de solde passe par les fonctions SQL `reserve_commission` et
 * `credit_balance`, qui verrouillent la ligne de la marque et écrivent une ligne
 * dans `brand_ledger`. On ne touche jamais `brands.balance` directement.
 */

/** Part Collabbs sur la commission d'affiliation, facturée en plus à la marque. */
export const AFFILIATE_FEE_RATE = 0.25;

/** Jours avant qu'une vente ne devienne définitive (fenêtre de retours). */
export const VALIDATION_DAYS = 30;

/** Montant minimum d'un versement, pour éviter les virements à 2 €. */
export const MIN_PAYOUT = 20;

export type SettlementStatus = "pending" | "unfunded";

/** Arrondi au centime — les flottants ne doivent jamais fuir vers la compta. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Décomposition d'une vente affiliée.
 * `commission` est ce que la campagne promet au créateur.
 */
export function affiliateBreakdown(commission: number) {
  const creatorAmount = round2(commission);
  const platformFee = round2(creatorAmount * AFFILIATE_FEE_RATE);
  return {
    creatorAmount,                                  // ce que touche le créateur
    platformFee,                                    // ce que garde Collabbs
    brandTotal: round2(creatorAmount + platformFee), // ce que débourse la marque
  };
}

type Admin = ReturnType<typeof createAdminClient>;

// Les colonnes et fonctions ajoutées par la migration 0035 ne sont pas encore
// dans `database.types.ts` (fichier généré depuis Supabase, à régénérer une fois
// la migration appliquée). En attendant, on isole les casts ici plutôt que de
// les disperser dans le code appelant.
/* eslint-disable @typescript-eslint/no-explicit-any */
const untyped = (admin: Admin) => admin as any;

/**
 * Réserve la commission d'une vente sur la provision de la marque.
 *
 * Appelé juste après l'insertion de l'événement de vente par les routes de
 * tracking. Tente une recharge automatique si la provision est insuffisante.
 *
 * Renvoie le statut posé sur la vente : "pending" (réservée, le créateur est
 * garanti) ou "unfunded" (commission due mais non couverte).
 */
export async function settleSale(params: {
  eventId: string;
  brandId: string;
  creatorId: string;
  commission: number;
  saleAmount: number | null;
}): Promise<SettlementStatus> {
  const { eventId, brandId, creatorId, commission } = params;
  const admin = createAdminClient();

  // Garde-fou : une vente déclarée par un navigateur attend la confirmation de
  // la marque. Tant que le drapeau est levé, aucun argent ne bouge — même si un
  // appelant se trompe. C'est la dernière barrière avant la provision, et elle
  // reste ici pour que tout nouveau chemin en hérite gratuitement.
  const { data: guard } = await untyped(admin)
    .from("affiliate_events")
    .select("needs_review")
    .eq("id", eventId)
    .maybeSingle();
  if (guard?.needs_review) return "unfunded";

  const { creatorAmount, platformFee, brandTotal } = affiliateBreakdown(commission);

  const validateAt = new Date();
  validateAt.setDate(validateAt.getDate() + VALIDATION_DAYS);

  // La vente porte d'emblée sa décomposition et sa date de validation, même si
  // la réservation échoue : on veut garder la trace de ce qui est dû.
  await untyped(admin)
    .from("affiliate_events")
    .update({
      commission_amount: creatorAmount,
      platform_fee: platformFee,
      validate_at: validateAt.toISOString(),
    })
    .eq("id", eventId);

  let reserved = await tryReserve(admin, brandId, eventId, brandTotal);

  if (!reserved) {
    // Provision à sec : on tente la recharge automatique avant d'abandonner.
    const topup = await attemptAutoTopup(brandId);
    if (topup.ok) {
      reserved = await tryReserve(admin, brandId, eventId, brandTotal);
    }
  }

  const status: SettlementStatus = reserved ? "pending" : "unfunded";
  const { error: errStatut } = await untyped(admin)
    .from("affiliate_events")
    .update({ status })
    .eq("id", eventId);
  if (errStatut && reserved) {
    // La provision de la marque est débitée et la vente ne le dit pas : le
    // créateur ne verrait pas sa commission, et la marque aurait payé pour
    // rien. On ne peut pas le corriger d'ici, mais ça ne doit pas rester
    // invisible.
    void reportError("affiliate/settle-statut", errStatut, {
      detail: `événement ${eventId} : ${brandTotal} € réservés sur la marque ${brandId}, statut "pending" non enregistré.`,
    });
  }

  if (!reserved) {
    await onProvisionExhausted(brandId, creatorId, brandTotal);
  }

  // Le cumul annuel de ce couple vient peut-être de franchir le seuil légal.
  // Import différé : `affiliate-contract` importe ce module pour ses
  // constantes, un import statique créerait un cycle.
  //
  // La commission est réglée quoi qu'il arrive : un échec ici ne doit pas
  // empêcher un créateur d'être payé. Le contrat est un devoir des Parties,
  // pas une condition du versement.
  try {
    const { ensureAffiliateFrameworkContract } = await import("@/lib/affiliate-contract");
    await ensureAffiliateFrameworkContract(brandId, creatorId);
  } catch (e) {
    console.error("[affiliate-billing] contrat-cadre : vérification impossible", e);
  }

  return status;
}

async function tryReserve(
  admin: Admin,
  brandId: string,
  eventId: string,
  amount: number,
): Promise<boolean> {
  const { data, error } = await untyped(admin).rpc("reserve_commission", {
    p_brand: brandId,
    p_event: eventId,
    p_amount: amount,
    p_label: "Commission d'affiliation",
  });
  if (error) {
    void reportError("affiliate/reserve", error, { detail: `événement ${eventId}` });
    return false;
  }
  return data === true;
}

/**
 * Rend à la marque une réservation devenue caduque : vente remboursée par le
 * marchand, ou écartée pour fraude. Idempotent — une vente déjà rendue ne l'est
 * pas deux fois.
 */
export async function releaseReservation(params: {
  eventId: string;
  status: "refunded" | "rejected";
  reason?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { eventId, status, reason } = params;
  const admin = createAdminClient();

  const { data: ev } = await untyped(admin)
    .from("affiliate_events")
    .select("id, status, commission_amount, platform_fee, link_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!ev) return { ok: false, message: "Vente introuvable." };
  if (ev.status === "refunded" || ev.status === "rejected") {
    return { ok: true, message: "Déjà traitée." };
  }
  const { data: linkRow } = await untyped(admin)
    .from("affiliate_links")
    .select("id, creator_id, campaigns(brand_id)")
    .eq("id", ev.link_id)
    .maybeSingle();
  const brandOf = linkRow?.campaigns?.brand_id as string | undefined;

  if (ev.status === "paid") {
    // L'argent est parti chez le créateur : on ne le reprend pas. On inscrit
    // une dette qui sera déduite de son prochain versement — c'est la pratique
    // du secteur, et c'est la seule honnête : reprendre un virement déjà reçu
    // n'est ni possible techniquement, ni acceptable pour le créateur.
    const owed = round2(Number(ev.commission_amount ?? 0));
    if (owed > 0 && linkRow?.creator_id) {
      await untyped(admin).from("affiliate_clawbacks").insert({
        creator_id: linkRow.creator_id,
        brand_id: brandOf ?? null,
        affiliate_event_id: eventId,
        amount: owed,
        reason: reason ?? "Vente remboursée après versement de la commission",
      });
      await notify({
        userId: linkRow.creator_id,
        type: "affiliate_clawback",
        title: `Une vente a été remboursée — ${owed.toFixed(2)} €`,
        body:
          "La marque a remboursé son client sur une vente qui t'avait déjà été " +
          "commissionnée. Ce montant sera déduit de ton prochain versement — rien " +
          "ne te sera repris sur ce que tu as déjà reçu.",
        link: "/payouts",
      });
    }
    await untyped(admin)
      .from("affiliate_events")
      .update({
        status,
        refunded_at: status === "refunded" ? new Date().toISOString() : null,
        reject_reason: reason ?? null,
      })
      .eq("id", eventId);
    return { ok: true, message: "Régularisation inscrite sur le prochain versement." };
  }

  const brandId = brandOf;
  const total = round2(Number(ev.commission_amount ?? 0) + Number(ev.platform_fee ?? 0));

  // ORDRE VOULU : on change le statut D'ABORD, et seulement si personne ne
  // l'a déjà changé (`.eq("status", ev.status)`).
  //
  // L'inverse — rendre l'argent puis marquer — était un remboursement en
  // double en puissance : si l'écriture du statut échouait, la vente restait
  // « pending », et le prochain passage recréditait la marque une seconde
  // fois. Ici, une seule exécution peut franchir cette porte ; les suivantes
  // ne touchent aucune ligne et s'arrêtent.
  const { data: pris, error: errStatut } = await untyped(admin)
    .from("affiliate_events")
    .update({
      status,
      refunded_at: status === "refunded" ? new Date().toISOString() : null,
      reject_reason: reason ?? null,
    })
    .eq("id", eventId)
    .eq("status", ev.status)
    .select("id");
  if (errStatut) {
    void reportError("affiliate/release-statut", errStatut, { detail: `événement ${eventId}` });
    return { ok: false, message: "La vente n'a pas pu être mise à jour. Réessaie." };
  }
  if (!pris || pris.length === 0) {
    // Quelqu'un d'autre est passé entre-temps : rien à rendre ici.
    return { ok: true, message: "Déjà traitée." };
  }

  // Seule une vente réservée a consommé de la provision. Une vente "unfunded"
  // n'a rien pris : il n'y a rien à rendre.
  if (brandId && ev.status === "pending" && total > 0) {
    const { error } = await untyped(admin).rpc("credit_balance", {
      p_brand: brandId,
      p_amount: total,
      p_kind: "reserve_release",
      p_event: eventId,
      p_stripe_ref: null,
      p_label: reason ?? (status === "refunded" ? "Vente remboursée" : "Vente écartée"),
    });
    if (error) {
      // Le crédit a échoué : on remet la vente dans son état d'origine, sinon
      // la marque perdrait sa réservation pour de bon — la prochaine tentative
      // trouverait « déjà traitée » et ne rendrait jamais rien.
      await untyped(admin)
        .from("affiliate_events")
        .update({ status: ev.status, refunded_at: null, reject_reason: null })
        .eq("id", eventId);
      void reportError("affiliate/release-credit", error, {
        detail: `événement ${eventId}, ${total} € à rendre à la marque ${brandId}`,
      });
      return { ok: false, message: "La provision n'a pas pu être recréditée." };
    }
  }

  return { ok: true };
}

/**
 * Crée (ou retrouve) le client Stripe de la marque. Nécessaire pour enregistrer
 * une carte et pouvoir la débiter hors session lors des recharges.
 */
export async function ensureBrandCustomer(brandId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: brand } = await untyped(admin)
    .from("brands")
    .select("id, name, stripe_customer_id")
    .eq("id", brandId)
    .maybeSingle();

  if (brand?.stripe_customer_id) return brand.stripe_customer_id as string;

  // L'email vit dans auth.users, pas dans profiles.
  const { data: authUser } = await admin.auth.admin.getUserById(brandId);

  const customer = await stripe.customers.create({
    name: brand?.name ?? undefined,
    email: authUser?.user?.email ?? undefined,
    metadata: { brand_id: brandId },
  });

  await untyped(admin)
    .from("brands")
    .update({ stripe_customer_id: customer.id })
    .eq("id", brandId);

  return customer.id;
}

/**
 * Débite la carte enregistrée pour recharger la provision.
 *
 * Hors session : la marque n'est pas devant son écran. Si sa banque exige une
 * authentification (3D Secure), le paiement échoue et il faut la prévenir pour
 * qu'elle recharge à la main — d'où le message explicite plutôt qu'un silence.
 */
export async function attemptAutoTopup(
  brandId: string,
): Promise<{ ok: boolean; amount?: number; message?: string }> {
  const admin = createAdminClient();
  const { data: brand } = await untyped(admin)
    .from("brands")
    .select("id, stripe_customer_id, payment_method_id, autotopup_enabled, autotopup_amount")
    .eq("id", brandId)
    .maybeSingle();

  if (!brand?.autotopup_enabled) {
    return { ok: false, message: "Recharge automatique désactivée." };
  }
  if (!brand.stripe_customer_id || !brand.payment_method_id) {
    return { ok: false, message: "Aucune carte enregistrée." };
  }

  const amount = Number(brand.autotopup_amount ?? 0);
  if (amount <= 0) return { ok: false, message: "Montant de recharge invalide." };

  try {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "eur",
      customer: brand.stripe_customer_id as string,
      payment_method: brand.payment_method_id as string,
      off_session: true,
      confirm: true,
      description: "Recharge automatique de la provision Collabbs",
      metadata: { brand_id: brandId, kind: "autotopup" },
    });

    if (intent.status !== "succeeded") {
      await flagTopupFailure(brandId);
      return { ok: false, message: `Paiement non abouti (${intent.status}).` };
    }

    await creditTopup(brandId, amount, intent.id, "Recharge automatique");
    return { ok: true, amount };
  } catch (err) {
    console.error("[affiliate-billing] recharge auto refusée", err);
    await flagTopupFailure(brandId);
    return { ok: false, message: "La carte a été refusée." };
  }
}

/** Crédite la provision après un paiement Stripe abouti. Idempotent via stripe_ref. */
export async function creditTopup(
  brandId: string,
  amount: number,
  stripeRef: string,
  label: string,
): Promise<{ ok: boolean; already?: boolean }> {
  const admin = createAdminClient();

  const { data: existing } = await untyped(admin)
    .from("brand_ledger")
    .select("id")
    .eq("stripe_ref", stripeRef)
    .maybeSingle();
  if (existing) return { ok: true, already: true };

  const { error } = await untyped(admin).rpc("credit_balance", {
    p_brand: brandId,
    p_amount: round2(amount),
    p_kind: "topup",
    p_event: null,
    p_stripe_ref: stripeRef,
    p_label: label,
  });
  if (error) {
    void reportError("affiliate/topup", error, { detail: `marque ${brandId}` });
    return { ok: false };
  }

  await untyped(admin)
    .from("brands")
    .update({ topup_failed_at: null })
    .eq("id", brandId);

  // La provision vient d'être renflouée : on régularise ce qui était dû.
  // C'est exactement ce que l'écran de facturation promet à la marque.
  const rattrapage = await reserveOutstanding(brandId);
  if (rattrapage.reserved > 0) {
    console.info(
      `[affiliate-billing] ${rattrapage.reserved}/${rattrapage.total} commission(s) régularisée(s) après approvisionnement`,
    );
  }

  return { ok: true };
}

/**
 * Réserve les commissions restées « non financées » faute de provision.
 *
 * Sans ça, le circuit avait un trou : une commission née pendant que la
 * provision était à sec restait `unfunded` POUR TOUJOURS. Rien ne la
 * repêchait — ni un approvisionnement, ni un cron. Le créateur n'était jamais
 * payé, alors que l'écran de facturation disait à la marque
 * « Approvisionne pour régulariser » : une promesse que le code ne tenait pas.
 *
 * Les plus anciennes d'abord : c'est le créateur qui attend depuis le plus
 * longtemps qui doit être servi en premier. On s'arrête à la première qui ne
 * passe pas — la provision est épuisée, inutile d'insister.
 */
export async function reserveOutstanding(
  brandId: string,
): Promise<{ reserved: number; total: number }> {
  const admin = createAdminClient();

  // Les commissions dues par CETTE marque : on passe par ses campagnes.
  const { data: campaigns } = await untyped(admin)
    .from("campaigns")
    .select("id")
    .eq("brand_id", brandId);
  const campaignIds = ((campaigns ?? []) as { id: string }[]).map((c) => c.id);
  if (campaignIds.length === 0) return { reserved: 0, total: 0 };

  const { data: links } = await untyped(admin)
    .from("affiliate_links")
    .select("id")
    .in("campaign_id", campaignIds);
  const linkIds = ((links ?? []) as { id: string }[]).map((l) => l.id);
  if (linkIds.length === 0) return { reserved: 0, total: 0 };

  const { data: dues } = await untyped(admin)
    .from("affiliate_events")
    .select("id, commission_amount, platform_fee")
    .eq("status", "unfunded")
    .in("link_id", linkIds)
    .order("occurred_at", { ascending: true });

  const lignes = ((dues ?? []) as {
    id: string;
    commission_amount: number | null;
    platform_fee: number | null;
  }[]).filter((e) => Number(e.commission_amount ?? 0) > 0);

  let reserved = 0;
  for (const e of lignes) {
    const total = round2(Number(e.commission_amount ?? 0) + Number(e.platform_fee ?? 0));
    const ok = await tryReserve(admin, brandId, e.id, total);
    if (!ok) break; // provision épuisée
    const validateAt = new Date();
    validateAt.setDate(validateAt.getDate() + VALIDATION_DAYS);
    await untyped(admin)
      .from("affiliate_events")
      .update({ status: "pending", validate_at: validateAt.toISOString() })
      .eq("id", e.id);
    reserved++;
  }

  return { reserved, total: lignes.length };
}

/**
 * Crée la session de paiement pour approvisionner la provision.
 *
 * `setup_future_usage: off_session` fait d'une pierre deux coups : la marque
 * paie ET sa carte est enregistrée pour les recharges automatiques suivantes.
 * Elle n'a donc jamais à saisir sa carte deux fois.
 */
export async function createTopupCheckout(params: {
  brandId: string;
  amount: number;
  origin: string;
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { brandId, amount, origin } = params;
  if (!Number.isFinite(amount) || amount < 20) {
    return { ok: false, error: "Le montant minimum d'approvisionnement est de 20 €." };
  }

  try {
    const customerId = await ensureBrandCustomer(brandId);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: "Provision Collabbs",
              description:
                "Approvisionnement du compte servant à payer les commissions d'affiliation de tes créateurs.",
            },
          },
        },
      ],
      payment_intent_data: { setup_future_usage: "off_session" },
      metadata: { brand_id: brandId, kind: "topup" },
      success_url: `${origin}/api/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?cancelled=1`,
    });
    return { ok: true, url: session.url ?? undefined };
  } catch (err) {
    console.error("[affiliate-billing] création du paiement d'approvisionnement", err);
    return { ok: false, error: "Le paiement n'a pas pu être ouvert." };
  }
}

/**
 * Traite le retour d'un approvisionnement : crédite la provision et retient la
 * carte pour les recharges futures. Appelé par la route de retour ET par le
 * webhook — d'où l'idempotence, qui repose sur la référence Stripe.
 */
export async function handleTopupCheckout(session: {
  metadata?: Record<string, string> | null;
  payment_status?: string;
  amount_total?: number | null;
  payment_intent?: string | { id: string } | null;
}): Promise<{ ok: boolean; brandId?: string }> {
  const brandId = session.metadata?.brand_id;
  if (!brandId || session.metadata?.kind !== "topup") return { ok: false };
  if (session.payment_status !== "paid") return { ok: false, brandId };

  const amount = (session.amount_total ?? 0) / 100;
  const intentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!intentId || amount <= 0) return { ok: false, brandId };

  const credited = await creditTopup(brandId, amount, intentId, "Approvisionnement");

  // Mémorise la carte utilisée pour pouvoir recharger sans la marque.
  if (credited.ok && !credited.already) {
    try {
      const intent = await stripe.paymentIntents.retrieve(intentId);
      const pm =
        typeof intent.payment_method === "string"
          ? intent.payment_method
          : intent.payment_method?.id;
      if (pm) {
        const admin = createAdminClient();
        await untyped(admin)
          .from("brands")
          .update({ payment_method_id: pm })
          .eq("id", brandId);
      }
    } catch (err) {
      // Sans carte mémorisée la recharge auto ne marchera pas, mais la provision
      // est bien créditée : on ne fait pas échouer le paiement pour autant.
      console.error("[affiliate-billing] carte non mémorisée", err);
    }
  }

  return { ok: credited.ok, brandId };
}

async function flagTopupFailure(brandId: string) {
  const admin = createAdminClient();
  await untyped(admin)
    .from("brands")
    .update({ topup_failed_at: new Date().toISOString() })
    .eq("id", brandId);
}

/**
 * Fait passer les ventes réservées à « validées » une fois le délai écoulé.
 * À partir de là, la commission est définitivement acquise au créateur : elle
 * ne peut plus être rendue à la marque automatiquement.
 */
export async function runAffiliateValidation(): Promise<{ validated: number }> {
  const admin = createAdminClient();
  const { data, error } = await untyped(admin)
    .from("affiliate_events")
    .update({ status: "validated" })
    .eq("status", "pending")
    .lte("validate_at", new Date().toISOString())
    .select("id");

  if (error) {
    // Sans signalement, une validation qui échoue tous les jours ne se voit
    // nulle part : les commissions resteraient « mises de côté » sans que
    // personne comprenne pourquoi elles ne sont jamais versées.
    void reportError("affiliate/validation", error);
    return { validated: 0 };
  }
  return { validated: (data ?? []).length };
}

/**
 * Verse aux créateurs les commissions acquises.
 *
 * Regroupe par créateur toutes les ventes validées, crée une transaction
 * récapitulative, puis transfère le net vers son compte Stripe connecté.
 * En dessous du minimum, on laisse s'accumuler jusqu'au mois suivant.
 *
 * Les ventes ne passent à « versée » qu'APRÈS un transfert Stripe abouti :
 * en cas d'échec elles restent validées et seront reprises au prochain passage.
 */
export async function runAffiliatePayouts(): Promise<{
  paid: number;
  skipped: number;
  failed: number;
}> {
  const admin = createAdminClient();
  const result = { paid: 0, skipped: 0, failed: 0 };

  // `payout_id is null` : une vente déjà rattachée à un versement ne doit
  // JAMAIS revenir dans un lot. C'est cette colonne qui sert de réservation
  // (voir la prise de lot plus bas) — sans elle, un échec d'écriture après un
  // virement réussi ferait repayer les mêmes ventes au passage suivant.
  const { data: events, error: errLecture } = await untyped(admin)
    .from("affiliate_events")
    .select("id, commission_amount, platform_fee, affiliate_links(creator_id)")
    .eq("status", "validated")
    .is("payout_id", null);
  if (errLecture) {
    // Un versement mensuel qui ne trouve rien à verser et un versement dont la
    // requête a échoué se ressemblent parfaitement dans les compteurs. Il faut
    // pouvoir les distinguer.
    void reportError("affiliate/payouts-lecture", errLecture);
    return result;
  }

  // Regroupement par créateur : un versement peut couvrir plusieurs marques.
  const byCreator = new Map<
    string,
    { ids: string[]; commission: number; fee: number }
  >();
  for (const e of (events ?? []) as any[]) {
    const creatorId = e.affiliate_links?.creator_id;
    if (!creatorId) continue;
    const bucket = byCreator.get(creatorId) ?? { ids: [], commission: 0, fee: 0 };
    bucket.ids.push(e.id);
    bucket.commission += Number(e.commission_amount ?? 0);
    bucket.fee += Number(e.platform_fee ?? 0);
    byCreator.set(creatorId, bucket);
  }

  for (const [creatorId, bucket] of byCreator) {
    // Régularisations en attente : commissions versées puis annulées parce que
    // la marque a remboursé son client. On les déduit ici, jamais en reprenant
    // un virement déjà reçu.
    const { data: clawbacks } = await untyped(admin)
      .from("affiliate_clawbacks")
      .select("id, amount")
      .eq("creator_id", creatorId)
      .is("settled_at", null);
    const owed = round2(
      (clawbacks ?? []).reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0),
    );

    const net = round2(bucket.commission - owed);
    if (net < MIN_PAYOUT) {
      // Sous le seuil — soit les gains sont faibles, soit la dette les absorbe.
      // Dans les deux cas on ne verse pas, et rien n'est perdu : les commissions
      // restent validées et la dette reste ouverte pour le mois suivant.
      result.skipped++;
      continue;
    }

    const { data: creator } = await untyped(admin)
      .from("creators")
      .select("id, stripe_account_id")
      .eq("id", creatorId)
      .maybeSingle();

    if (!creator?.stripe_account_id) {
      // Le créateur n'a pas terminé son inscription bancaire : on le relance
      // plutôt que de laisser l'argent dormir sans explication.
      result.skipped++;
      await notify({
        userId: creatorId,
        type: "affiliate_payout_blocked",
        title: `${net.toFixed(2)} € t'attendent`,
        body:
          "Tes commissions d'affiliation sont acquises, mais il te manque ton compte " +
          "de paiement pour les recevoir. Ça prend deux minutes.",
        link: "/payouts",
        throttleMinutes: 10080,
      });
      continue;
    }

    const fee = round2(bucket.fee);
    const { data: tx, error: txErr } = await untyped(admin)
      .from("transactions")
      .insert({
        type: "affiliate_payout",
        deal_id: null,
        brand_id: null, // un versement peut couvrir plusieurs marques
        creator_id: creatorId,
        gross_amount: round2(net + fee),
        // Un TAUX (0,25), pas un pourcentage : c'est la convention de
        // `deal_payment` (0,1) et celle que lit la facture. Écrit en
        // pourcentage ici, il s'affichait « Commission Collabbs (2500 %) ».
        platform_fee_rate: AFFILIATE_FEE_RATE,
        platform_fee: fee,
        net_amount: net,
        currency: "eur",
        status: "pending",
      })
      .select("id")
      .single();

    if (txErr || !tx) {
      void reportError("affiliate/payout", txErr, { detail: `créateur ${creatorId}` });
      result.failed++;
      continue;
    }

    // PRISE DU LOT, avant tout mouvement d'argent : on rattache les ventes à
    // cette transaction, et seulement celles que personne n'a déjà prises.
    // Si on faisait le virement d'abord, une écriture ratée juste après
    // laisserait les ventes « validées » et le passage suivant les paierait
    // une seconde fois — de l'argent réel, deux fois.
    const { data: prises, error: errPrise } = await untyped(admin)
      .from("affiliate_events")
      .update({ payout_id: tx.id })
      .in("id", bucket.ids)
      .eq("status", "validated")
      .is("payout_id", null)
      .select("id");

    if (errPrise || !prises || prises.length !== bucket.ids.length) {
      // Lot incomplet : une autre exécution est passée en même temps, ou
      // l'écriture a échoué. On rend ce qu'on avait pris et on laisse le
      // prochain passage refaire le compte proprement — rien n'est perdu.
      await untyped(admin)
        .from("affiliate_events")
        .update({ payout_id: null })
        .eq("payout_id", tx.id);
      await untyped(admin).from("transactions").update({ status: "cancelled" }).eq("id", tx.id);
      void reportError("affiliate/payout-prise", errPrise ?? "lot incomplet", {
        detail: `créateur ${creatorId} · ${prises?.length ?? 0}/${bucket.ids.length} ventes prises`,
      });
      result.failed++;
      continue;
    }

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: Math.round(net * 100),
          currency: "eur",
          destination: creator.stripe_account_id as string,
          description: "Commissions d'affiliation Collabbs",
          metadata: { creator_id: creatorId, transaction_id: tx.id },
        },
        // Second rempart : même relancée, cette transaction ne peut donner
        // lieu qu'à un seul virement.
        { idempotencyKey: `affiliate-payout-${tx.id}` },
      );

      const { error: errTx } = await untyped(admin)
        .from("transactions")
        .update({
          status: "paid",
          reference: transfer.id,
          paid_at: new Date().toISOString(),
        })
        .eq("id", tx.id);
      if (errTx) {
        void reportError("affiliate/payout-transaction", errTx, {
          detail: `Virement ${transfer.id} parti (${net} € au créateur ${creatorId}) mais la transaction ${tx.id} n'a pas pu passer à "paid".`,
        });
      }

      const { error: errVentes } = await untyped(admin)
        .from("affiliate_events")
        .update({ status: "paid", paid_at: new Date().toISOString(), payout_id: tx.id })
        .in("id", bucket.ids);
      if (errVentes) {
        // Les ventes restent rattachées à cette transaction (`payout_id`), donc
        // elles ne repartiront pas dans un autre lot. Il reste à corriger leur
        // statut à la main : on le signale.
        void reportError("affiliate/payout-ventes", errVentes, {
          detail: `Virement ${transfer.id} parti pour le créateur ${creatorId} ; ${bucket.ids.length} ventes non passées à "paid".`,
        });
      }

      // La dette est soldée seulement maintenant : si le virement avait échoué,
      // elle serait restée ouverte pour le mois suivant.
      if (owed > 0) {
        await untyped(admin)
          .from("affiliate_clawbacks")
          .update({ settled_at: new Date().toISOString(), settled_by_tx: tx.id })
          .in("id", (clawbacks ?? []).map((c: any) => c.id));
      }

      await notify({
        userId: creatorId,
        type: "affiliate_payout_sent",
        title: `💸 ${net.toFixed(2)} € en route`,
        body:
          (owed > 0
            ? `Tes commissions d'affiliation viennent d'être versées, après déduction de ${owed.toFixed(2)} € correspondant à des ventes remboursées par la marque. `
            : "Tes commissions d'affiliation viennent d'être versées sur ton compte. ") +
          "Compte 2 à 3 jours ouvrés avant de les voir sur ton compte bancaire.",
        link: "/payouts",
      });

      result.paid++;
    } catch (err) {
      // Transfert refusé (solde plateforme insuffisant, compte incomplet…) :
      // on annule la transaction, les ventes restent validées pour le prochain tour.
      void reportError("affiliate/transfer", err, {
        detail: `créateur ${creatorId} · ${net} €`,
      });
      // On relâche le lot : les ventes redeviennent disponibles pour le
      // prochain passage. Sans ça, elles resteraient réservées à une
      // transaction annulée et ne seraient plus jamais versées.
      await untyped(admin)
        .from("affiliate_events")
        .update({ payout_id: null })
        .eq("payout_id", tx.id);
      await untyped(admin)
        .from("transactions")
        .update({ status: "cancelled" })
        .eq("id", tx.id);
      result.failed++;
    }
  }

  return result;
}

/**
 * Provision épuisée : la commission est due mais non couverte.
 * On prévient la marque tout de suite — c'est sa réputation auprès des créateurs
 * qui est en jeu — et on informe le créateur sans l'alarmer inutilement.
 */
async function onProvisionExhausted(brandId: string, creatorId: string, missing: number) {
  await notify({
    userId: brandId,
    type: "provision_exhausted",
    title: "Ta provision est épuisée",
    body:
      `Une vente vient d'être enregistrée mais ta provision ne couvre plus la commission ` +
      `(${missing.toFixed(2)} € manquants). Recharge maintenant pour que tes créateurs ` +
      `soient payés — sans provision, tes campagnes d'affiliation ne peuvent plus tourner.`,
    link: "/billing",
    throttleMinutes: 60,
  });

  await notify({
    userId: creatorId,
    type: "commission_pending_funding",
    title: "Une vente est en attente de financement",
    body:
      "Tu as généré une vente, mais la marque doit réapprovisionner son compte avant " +
      "que la commission te soit acquise. Elle a été prévenue.",
    link: "/activity",
    throttleMinutes: 1440,
  });
}
