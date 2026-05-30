"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";

export type CampaignType = "affiliation" | "video" | "hybrid" | "performance";

export type CampaignData = {
  type: CampaignType;
  name: string;
  description: string;
  requirements: string;
  fixedAmount: number | null;
  perfRate: number | null;
  targetUrl: string;
  minSubscribers: number | null;
  spots: number | null;
  commission: { nano: number; micro: number; mid: number; macro: number };
  niches: number[];
  platforms: number[];
};

export async function createCampaign(
  data: CampaignData,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const withAffiliation = data.type === "affiliation" || data.type === "hybrid";
  const withFixed = data.type === "video" || data.type === "hybrid";
  const isPerformance = data.type === "performance";

  const { data: inserted, error } = await supabase
    .from("campaigns")
    .insert({
      brand_id: user.id,
      name: data.name,
      description: data.description || null,
      requirements: data.requirements || null,
      type: data.type,
      status: "active",
      target_url: data.targetUrl || null,
      min_subscribers: data.minSubscribers,
      spots: data.spots,
      commission_type: withAffiliation
        ? "percentage"
        : isPerformance
          ? "fixed_per_action"
          : null,
      commission_value: isPerformance ? data.perfRate : null,
      commission_unit: isPerformance ? "1000 vues" : null,
      commission_nano: withAffiliation ? data.commission.nano : null,
      commission_micro: withAffiliation ? data.commission.micro : null,
      commission_mid: withAffiliation ? data.commission.mid : null,
      commission_macro: withAffiliation ? data.commission.macro : null,
      fixed_amount: withFixed ? data.fixedAmount : null,
    })
    .select("id")
    .single();
  if (error || !inserted) return { ok: false, error: error?.message ?? "Erreur." };

  if (data.niches.length > 0) {
    await supabase
      .from("campaign_niches")
      .insert(data.niches.map((niche_id) => ({ campaign_id: inserted.id, niche_id })));
  }
  if (data.platforms.length > 0) {
    await supabase
      .from("campaign_platforms")
      .insert(
        data.platforms.map((platform_id) => ({ campaign_id: inserted.id, platform_id })),
      );
  }

  revalidatePath("/dashboard");
  return { ok: true, id: inserted.id };
}

/** La marque accepte ou refuse une candidature reçue sur l'une de ses campagnes. */
export async function decideApplication(
  applicationId: string,
  decision: "accepted" | "rejected",
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // On vérifie que la candidature porte bien sur une campagne de cette marque.
  const { data: app } = await supabase
    .from("applications")
    .select("id, campaign_id, creator_id, campaigns(brand_id, name)")
    .eq("id", applicationId)
    .single();
  if (!app) return { ok: false, error: "Candidature introuvable." };
  if (app.campaigns?.brand_id !== user.id)
    return { ok: false, error: "Action non autorisée." };

  const { error } = await supabase
    .from("applications")
    .update({ status: decision })
    .eq("id", applicationId);
  if (error) return { ok: false, error: error.message };

  // Notif au créateur
  const campaignName = app.campaigns?.name ?? "ta campagne";
  if (decision === "accepted") {
    await notify({
      userId: app.creator_id,
      type: "application_accepted",
      title: `Ta candidature à "${campaignName}" a été acceptée 🎉`,
      body: "La marque te propose de collaborer. Ouvre la collaboration pour voir les prochaines étapes.",
      link: "/opportunities",
    });
  } else {
    await notify({
      userId: app.creator_id,
      type: "application_rejected",
      title: `Candidature non retenue pour "${campaignName}"`,
      body: "Ne le prends pas mal — d'autres campagnes t'attendent. Continue à explorer les opportunités.",
      link: "/opportunities",
    });
  }

  revalidatePath(`/campaigns/${app.campaign_id}`);
  return { ok: true };
}

/** La marque met sa campagne en pause (ended) ou la réactive. */
export async function setCampaignStatus(
  campaignId: string,
  status: "active" | "ended",
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { error } = await supabase
    .from("campaigns")
    .update({ status })
    .eq("id", campaignId)
    .eq("brand_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return { ok: true };
}
