"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

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
    .select("creator_id, status")
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

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
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
    .select("brand_id, status")
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

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  return { ok: true };
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
