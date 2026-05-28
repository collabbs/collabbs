"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CampaignType = "affiliation" | "video" | "hybrid" | "performance";

export type CampaignData = {
  type: CampaignType;
  name: string;
  description: string;
  requirements: string;
  fixedAmount: number | null;
  perfRate: number | null;
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
