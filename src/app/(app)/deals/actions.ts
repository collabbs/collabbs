"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, stripeConfigured } from "@/lib/stripe";

type Result = { ok: boolean; error?: string };

/** Référence de contrat lisible, style CLB-XXXXXX. */
function contractRef(): string {
  return "CLB-" + crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

/**
 * La marque crée un deal à partir d'une candidature acceptée.
 * Pré-rempli depuis la campagne, statut "negotiation", livrables seedés.
 */
export async function createDealFromApplication(applicationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: app } = await supabase
    .from("applications")
    .select(
      "id, creator_id, campaign_id, status, campaigns(brand_id, name, type, fixed_amount, campaign_platforms(platform_id))",
    )
    .eq("id", applicationId)
    .single();
  if (!app || app.campaigns?.brand_id !== user.id) redirect("/campaigns");
  if (app.status !== "accepted") redirect(`/campaigns/${app.campaign_id}`);

  // Évite les doublons : si un deal existe déjà pour ce duo+campagne, on y va.
  const { data: existing } = await supabase
    .from("deals")
    .select("id")
    .eq("brand_id", user.id)
    .eq("creator_id", app.creator_id)
    .eq("campaign_id", app.campaign_id)
    .maybeSingle();
  if (existing) redirect(`/deals/${existing.id}`);

  const platformId = app.campaigns?.campaign_platforms?.[0]?.platform_id ?? null;
  const amount = app.campaigns?.fixed_amount ?? 0;

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      brand_id: user.id,
      creator_id: app.creator_id,
      campaign_id: app.campaign_id,
      title: app.campaigns?.name ?? "Collaboration",
      amount,
      format: "video_post",
      platform_id: platformId,
      quantity: 1,
      status: "negotiation",
    })
    .select("id")
    .single();
  if (error || !deal) redirect(`/campaigns/${app.campaign_id}`);

  // Livrables par défaut.
  await supabase.from("deliverables").insert([
    { deal_id: deal.id, label: "Contenu livré", position: 1 },
    { deal_id: deal.id, label: "Validation finale de la marque", position: 2 },
  ]);

  // Contrat (brouillon) — figé et signé à l'acceptation du créateur.
  await supabase
    .from("contracts")
    .insert({ deal_id: deal.id, reference: contractRef(), status: "draft" });

  redirect(`/deals/${deal.id}`);
}

/**
 * Booking direct : une marque propose une collaboration à un créateur depuis son
 * profil (sans passer par une campagne). Crée un deal en "negotiation".
 */
export async function createDirectDeal(creatorId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (creatorId === user.id) redirect("/creators");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "brand") redirect("/creators");

  // Évite les doublons : deal direct (sans campagne) déjà ouvert avec ce créateur.
  const { data: open } = await supabase
    .from("deals")
    .select("id")
    .eq("brand_id", user.id)
    .eq("creator_id", creatorId)
    .is("campaign_id", null)
    .in("status", ["negotiation", "active"])
    .limit(1);
  if (open && open.length > 0) redirect(`/deals/${open[0].id}`);

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      brand_id: user.id,
      creator_id: creatorId,
      campaign_id: null,
      title: "Collaboration",
      amount: 0,
      format: "video_post",
      quantity: 1,
      status: "negotiation",
    })
    .select("id")
    .single();
  if (error || !deal) redirect("/creators");

  await supabase.from("deliverables").insert([
    { deal_id: deal.id, label: "Contenu livré", position: 1 },
    { deal_id: deal.id, label: "Validation finale de la marque", position: 2 },
  ]);

  await supabase
    .from("contracts")
    .insert({ deal_id: deal.id, reference: contractRef(), status: "draft" });

  redirect(`/deals/${deal.id}`);
}

/** La marque ajuste les termes pendant la négociation. */
export async function updateDealTerms(
  dealId: string,
  data: { amount: number; quantity: number; deadline: string | null; brandNotes: string | null },
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, status")
    .eq("id", dealId)
    .single();
  if (!deal || deal.brand_id !== user.id) return { ok: false, error: "Action non autorisée." };
  if (deal.status !== "negotiation")
    return { ok: false, error: "Les termes ne sont modifiables qu'en négociation." };

  const { error } = await supabase
    .from("deals")
    .update({
      amount: Math.max(0, Math.round(data.amount)),
      quantity: Math.max(1, Math.round(data.quantity)),
      deadline: data.deadline || null,
      brand_notes: data.brandNotes?.trim() || null,
    })
    .eq("id", dealId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}

/** Le créateur accepte le deal → passe en "active". */
export async function acceptDeal(dealId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select(
      "creator_id, status, title, amount, format, platform_id, quantity, deadline, brand_notes",
    )
    .eq("id", dealId)
    .single();
  if (!deal || deal.creator_id !== user.id) return { ok: false, error: "Action non autorisée." };
  if (deal.status !== "negotiation")
    return { ok: false, error: "Ce deal n'est plus en négociation." };

  const { error } = await supabase
    .from("deals")
    .update({ status: "active" })
    .eq("id", dealId);
  if (error) return { ok: false, error: error.message };

  // Le contrat est figé (snapshot des termes) et signé par les 2 parties :
  // la marque a proposé ces termes, le créateur les accepte tels quels.
  const now = new Date().toISOString();
  await supabase
    .from("contracts")
    .update({
      status: "signed",
      brand_signed_at: now,
      creator_signed_at: now,
      terms_snapshot: {
        title: deal.title,
        amount: deal.amount,
        format: deal.format,
        platform_id: deal.platform_id,
        quantity: deal.quantity,
        deadline: deal.deadline,
        brand_notes: deal.brand_notes,
      },
    })
    .eq("deal_id", dealId);

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  return { ok: true };
}

/** Annulation par l'une ou l'autre partie (tant que non terminé). */
export async function cancelDeal(dealId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, creator_id, status")
    .eq("id", dealId)
    .single();
  if (!deal || (deal.brand_id !== user.id && deal.creator_id !== user.id))
    return { ok: false, error: "Action non autorisée." };
  if (deal.status === "completed" || deal.status === "cancelled")
    return { ok: false, error: "Ce deal est déjà clôturé." };

  const { error } = await supabase
    .from("deals")
    .update({ status: "cancelled" })
    .eq("id", dealId);
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("contracts")
    .update({ status: "terminated", terminated_at: new Date().toISOString() })
    .eq("deal_id", dealId);

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  return { ok: true };
}

/**
 * Le créateur dépose le lien de sa publication (post / dossier UGC / etc.) et
 * marque automatiquement le livrable comme livré. Modifiable tant que la marque
 * n'a pas validé.
 */
export async function setDeliverableSubmission(
  deliverableId: string,
  url: string,
  notes: string,
): Promise<Result> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return { ok: false, error: "Lien requis." };
  try {
    const u = new URL(trimmedUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:")
      return { ok: false, error: "Le lien doit commencer par http(s)." };
  } catch {
    return { ok: false, error: "Lien invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: d } = await supabase
    .from("deliverables")
    .select("deal_id, approved, deals(creator_id, status)")
    .eq("id", deliverableId)
    .single();
  if (!d || d.deals?.creator_id !== user.id)
    return { ok: false, error: "Action non autorisée." };
  if (d.deals?.status !== "active") return { ok: false, error: "Le deal n'est pas en cours." };
  if (d.approved) return { ok: false, error: "Déjà validé par la marque." };

  const { error } = await supabase
    .from("deliverables")
    .update({
      submission_url: trimmedUrl,
      submission_notes: notes.trim() || null,
      submitted_at: new Date().toISOString(),
      done: true,
    })
    .eq("id", deliverableId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/deals/${d.deal_id}`);
  return { ok: true };
}

/** Le créateur marque un livrable comme fait / pas fait. */
export async function setDeliverableDone(
  deliverableId: string,
  done: boolean,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: d } = await supabase
    .from("deliverables")
    .select("deal_id, deals(creator_id, status)")
    .eq("id", deliverableId)
    .single();
  if (!d || d.deals?.creator_id !== user.id) return { ok: false, error: "Action non autorisée." };
  if (d.deals?.status !== "active") return { ok: false, error: "Le deal n'est pas en cours." };

  const { error } = await supabase
    .from("deliverables")
    .update({ done })
    .eq("id", deliverableId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/deals/${d.deal_id}`);
  return { ok: true };
}

/** La marque valide (ou retire la validation d') un livrable. */
export async function setDeliverableApproved(
  deliverableId: string,
  approved: boolean,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: d } = await supabase
    .from("deliverables")
    .select("deal_id, deals(brand_id, status)")
    .eq("id", deliverableId)
    .single();
  if (!d || d.deals?.brand_id !== user.id) return { ok: false, error: "Action non autorisée." };

  const { error } = await supabase
    .from("deliverables")
    .update({ approved })
    .eq("id", deliverableId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/deals/${d.deal_id}`);
  return { ok: true };
}

/** La marque clôture le deal → "completed" (tous les livrables validés requis). */
export async function completeDeal(dealId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, creator_id, status")
    .eq("id", dealId)
    .single();
  if (!deal || deal.brand_id !== user.id) return { ok: false, error: "Action non autorisée." };
  if (deal.status !== "active") return { ok: false, error: "Le deal n'est pas en cours." };

  const { data: dels } = await supabase
    .from("deliverables")
    .select("approved")
    .eq("deal_id", dealId);
  const allApproved = (dels ?? []).length > 0 && (dels ?? []).every((d) => d.approved);
  if (!allApproved)
    return { ok: false, error: "Tous les livrables doivent être validés avant de clôturer." };

  const { error } = await supabase
    .from("deals")
    .update({ status: "completed" })
    .eq("id", dealId);
  if (error) return { ok: false, error: error.message };

  // Tente le versement au créateur (non bloquant : si son compte n'est pas prêt,
  // les fonds restent en séquestre et il pourra déclencher le versement ensuite).
  await attemptDealPayout(dealId);

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  return { ok: true };
}

/**
 * Verse au créateur sa part (net) du séquestre vers son compte connecté.
 * Utilise `source_transaction` (le paiement de la marque) pour autoriser le
 * transfert même si le solde disponible n'est pas encore consolidé.
 * Renvoie le détail pour pouvoir afficher l'erreur réelle au besoin.
 */
async function attemptDealPayout(
  dealId: string,
): Promise<{ released: boolean; error?: string }> {
  if (!stripeConfigured) return { released: false, error: "Stripe non configuré." };
  const admin = createAdminClient();

  const { data: deal } = await admin
    .from("deals")
    .select("creator_id, status")
    .eq("id", dealId)
    .single();
  if (!deal || deal.status !== "completed")
    return { released: false, error: "Le deal n'est pas terminé." };

  const { data: tx } = await admin
    .from("transactions")
    .select("id, net_amount, status, reference")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (!tx) return { released: false, error: "Aucun paiement en séquestre." };
  if (tx.status === "released" || tx.status === "paid") return { released: true };
  if (tx.status !== "in_escrow")
    return { released: false, error: "Ce paiement ne peut pas être versé." };

  const { data: cr } = await admin
    .from("creators")
    .select("stripe_account_id")
    .eq("id", deal.creator_id)
    .single();
  if (!cr?.stripe_account_id)
    return { released: false, error: "Le créateur n'a pas encore connecté son compte." };

  try {
    const account = await stripe.accounts.retrieve(cr.stripe_account_id);
    if (account.capabilities?.transfers !== "active")
      return { released: false, error: "Le compte du créateur n'est pas encore prêt à recevoir." };

    let sourceCharge: string | undefined;
    if (tx.reference) {
      const pi = await stripe.paymentIntents.retrieve(tx.reference);
      sourceCharge =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : (pi.latest_charge?.id ?? undefined);
    }

    await stripe.transfers.create({
      amount: Math.round(Number(tx.net_amount) * 100),
      currency: "eur",
      destination: cr.stripe_account_id,
      ...(sourceCharge ? { source_transaction: sourceCharge } : {}),
      metadata: { deal_id: dealId },
    });
    await admin
      .from("transactions")
      .update({ status: "released", escrow_released_at: new Date().toISOString() })
      .eq("id", tx.id);
    return { released: true };
  } catch (e) {
    return { released: false, error: e instanceof Error ? e.message : "Échec du versement." };
  }
}

/** Déclenche/réessaie le versement de la part créateur (créateur ou marque). */
export async function releaseDealPayout(dealId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, creator_id")
    .eq("id", dealId)
    .single();
  if (!deal || (deal.brand_id !== user.id && deal.creator_id !== user.id))
    return { ok: false, error: "Action non autorisée." };

  const res = await attemptDealPayout(dealId);
  if (!res.released) return { ok: false, error: res.error ?? "Versement impossible pour le moment." };

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/payouts");
  return { ok: true };
}

/** Le créateur relie/complète son compte Stripe pour recevoir ses paiements. */
export async function startCreatorPayoutOnboarding() {
  if (!stripeConfigured) redirect("/payouts?error=stripe");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "creator") redirect("/dashboard");

  const { data: creator } = await supabase
    .from("creators")
    .select("stripe_account_id")
    .eq("id", user.id)
    .single();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;

  let linkUrl: string | null = null;
  let failed = false;
  try {
    let accountId = creator?.stripe_account_id ?? null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email ?? undefined,
        metadata: { creator_id: user.id },
        capabilities: { transfers: { requested: true } },
      });
      accountId = account.id;
      await supabase.from("creators").update({ stripe_account_id: accountId }).eq("id", user.id);
    }
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/payouts?refresh=1`,
      return_url: `${origin}/payouts?done=1`,
      type: "account_onboarding",
    });
    linkUrl = link.url;
  } catch {
    failed = true;
  }
  if (failed) redirect("/payouts?error=connect");
  if (linkUrl) redirect(linkUrl);
  redirect("/payouts");
}

/** La marque rembourse un paiement encore en séquestre (avant versement). */
export async function refundDeal(dealId: string): Promise<Result> {
  if (!stripeConfigured) return { ok: false, error: "Stripe non configuré." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id")
    .eq("id", dealId)
    .single();
  if (!deal || deal.brand_id !== user.id) return { ok: false, error: "Action non autorisée." };

  const admin = createAdminClient();
  const { data: tx } = await admin
    .from("transactions")
    .select("id, status, reference")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (!tx) return { ok: false, error: "Aucun paiement à rembourser." };
  if (tx.status !== "in_escrow")
    return { ok: false, error: "Ce paiement ne peut plus être remboursé." };
  if (!tx.reference) return { ok: false, error: "Référence de paiement introuvable." };

  try {
    await stripe.refunds.create({ payment_intent: tx.reference });
  } catch {
    return { ok: false, error: "Le remboursement Stripe a échoué." };
  }
  await admin.from("transactions").update({ status: "refunded" }).eq("id", tx.id);

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  return { ok: true };
}

/**
 * La marque règle le deal : crée une session Stripe Checkout (mode test).
 * Les fonds vont sur la balance plateforme = séquestre, jusqu'au versement
 * au créateur à la clôture (versement via Connect — étape suivante).
 */
export async function createDealCheckout(dealId: string) {
  if (!stripeConfigured) redirect(`/deals/${dealId}?stripe=missing`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, creator_id, title, amount, status")
    .eq("id", dealId)
    .single();
  if (!deal || deal.brand_id !== user.id) redirect("/deals");
  if (deal.status !== "active" || !deal.amount || deal.amount <= 0)
    redirect(`/deals/${dealId}`);

  // Déjà payé ?
  const { data: tx } = await supabase
    .from("transactions")
    .select("id")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (tx) redirect(`/deals/${dealId}`);

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          product_data: { name: deal.title ?? "Collaboration Collabbs" },
          unit_amount: deal.amount * 100,
        },
      },
    ],
    metadata: { deal_id: dealId, brand_id: deal.brand_id, creator_id: deal.creator_id },
    payment_intent_data: { metadata: { deal_id: dealId } },
    success_url: `${origin}/api/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/deals/${dealId}?canceled=1`,
  });

  if (session.url) redirect(session.url);
  redirect(`/deals/${dealId}`);
}

/** La marque laisse un avis sur un deal terminé (1 avis par deal). */
export async function leaveReview(
  dealId: string,
  rating: number,
  comment: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const r = Math.round(rating);
  if (r < 1 || r > 5) return { ok: false, error: "Note invalide." };

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, creator_id, status")
    .eq("id", dealId)
    .single();
  if (!deal || deal.brand_id !== user.id) return { ok: false, error: "Action non autorisée." };
  if (deal.status !== "completed")
    return { ok: false, error: "Tu pourras laisser un avis une fois le deal terminé." };

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("deal_id", dealId)
    .maybeSingle();
  if (existing) return { ok: false, error: "Tu as déjà laissé un avis pour ce deal." };

  const { error } = await supabase.from("reviews").insert({
    deal_id: dealId,
    brand_id: user.id,
    creator_id: deal.creator_id,
    rating: r,
    comment: comment.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}
