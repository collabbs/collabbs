"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function activateAffiliateLink(
  campaignId: string,
): Promise<{ ok: boolean; code?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: existing } = await supabase
    .from("affiliate_links")
    .select("code")
    .eq("creator_id", user.id)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (existing) return { ok: true, code: existing.code };

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const { error } = await supabase
    .from("affiliate_links")
    .insert({ campaign_id: campaignId, creator_id: user.id, code });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/opportunities");
  return { ok: true, code };
}

export async function applyToCampaign(
  campaignId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("creator_id", user.id)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (existing) return { ok: true };

  const { error } = await supabase.from("applications").insert({
    campaign_id: campaignId,
    creator_id: user.id,
    initiated_by: "creator",
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/opportunities");
  return { ok: true };
}
