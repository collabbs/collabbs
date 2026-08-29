import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { notify } from "@/lib/notifications";

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
  await untyped(admin).from("affiliate_events").update({ status }).eq("id", eventId);

  if (!reserved) {
    await onProvisionExhausted(brandId, creatorId, brandTotal);
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
    console.error("[affiliate-billing] reserve_commission a échoué", error);
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
      console.error("[affiliate-billing] credit_balance a échoué", error);
      return { ok: false, message: "La provision n'a pas pu être recréditée." };
    }
  }

  await untyped(admin)
    .from("affiliate_events")
    .update({
      status,
      refunded_at: status === "refunded" ? new Date().toISOString() : null,
      reject_reason: reason ?? null,
    })
    .eq("id", eventId);

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
    console.error("[affiliate-billing] credit_balance (topup) a échoué", error);
    return { ok: false };
  }

  await untyped(admin)
    .from("brands")
    .update({ topup_failed_at: null })
    .eq("id", brandId);

  return { ok: true };
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
    console.error("[affiliate-billing] validation échouée", error);
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

  const { data: events } = await untyped(admin)
    .from("affiliate_events")
    .select("id, commission_amount, platform_fee, affiliate_links(creator_id)")
    .eq("status", "validated");

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
        platform_fee_rate: AFFILIATE_FEE_RATE * 100,
        platform_fee: fee,
        net_amount: net,
        currency: "eur",
        status: "pending",
      })
      .select("id")
      .single();

    if (txErr || !tx) {
      console.error("[affiliate-billing] transaction de versement impossible", txErr);
      result.failed++;
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(net * 100),
        currency: "eur",
        destination: creator.stripe_account_id as string,
        description: "Commissions d'affiliation Collabbs",
        metadata: { creator_id: creatorId, transaction_id: tx.id },
      });

      await untyped(admin)
        .from("transactions")
        .update({
          status: "paid",
          reference: transfer.id,
          paid_at: new Date().toISOString(),
        })
        .eq("id", tx.id);

      await untyped(admin)
        .from("affiliate_events")
        .update({ status: "paid", paid_at: new Date().toISOString(), payout_id: tx.id })
        .in("id", bucket.ids);

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
      console.error("[affiliate-billing] transfert Stripe refusé", err);
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
