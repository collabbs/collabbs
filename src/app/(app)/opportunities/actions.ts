"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { fabriquerCodePromo } from "@/lib/promo-code";

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

  const [{ data: camp }, { data: meProfile }, { data: moi }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("brand_id, name, with_promo_code, promo_code")
      .eq("id", campaignId)
      .single(),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("creators").select("handle").eq("id", user.id).maybeSingle(),
  ]);

  // Le code promo était le grand absent : il n'était JAMAIS posé, donc
  // `/api/track/promo` — qui résout la vente par ce code — répondait « code
  // promo introuvable » à chaque appel, et la fiche de campagne affichait
  // éternellement un faux exemple, « TON@HANDLE-XX ».
  //
  // Il est unique par créateur, sinon une vente n'est attribuable à personne.
  // Le code de la marque sert de préfixe : « MAISON » → « MAISON-JULIEN ».
  let promoCode: string | null = null;
  if (camp?.with_promo_code) {
    for (let tentative = 0; tentative < 5 && !promoCode; tentative++) {
      const candidat = fabriquerCodePromo(camp.promo_code, moi?.handle, tentative);
      const { data: pris } = await supabase
        .from("affiliate_links")
        .select("id")
        .eq("promo_code", candidat)
        .maybeSingle();
      if (!pris) promoCode = candidat;
    }
  }

  const { error } = await supabase
    .from("affiliate_links")
    .insert({ campaign_id: campaignId, creator_id: user.id, code, promo_code: promoCode });
  if (error) return { ok: false, error: error.message };
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
