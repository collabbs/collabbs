"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";

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

  // Notifie la marque qu'un nouveau créateur vient de rejoindre son programme.
  const [{ data: camp }, { data: meProfile }] = await Promise.all([
    supabase.from("campaigns").select("brand_id, name").eq("id", campaignId).single(),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);
  if (camp?.brand_id) {
    await notify({
      userId: camp.brand_id,
      type: "affiliate_joined",
      title: `${meProfile?.display_name ?? "Un créateur"} vient de rejoindre "${camp.name}"`,
      body: "Tu as un nouvel affilié actif. Suis ses performances depuis la page de ta campagne.",
      link: `/campaigns/${campaignId}`,
    });
  }

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${campaignId}`);
  return { ok: true, code };
}

export async function applyToCampaign(
  campaignId: string,
  message?: string,
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
    message: message?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${campaignId}`);
  return { ok: true };
}
