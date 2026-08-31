"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Ajoute un exemple de contenu (URL + caption) à une campagne. */
export async function addCampaignExample(
  campaignId: string,
  url: string,
  caption: string,
): Promise<{ ok: boolean; error?: string }> {
  const u = url.trim();
  const cap = caption.trim();
  if (!u && !cap) {
    return { ok: false, error: "Ajoute au moins une URL ou une description." };
  }
  // Validation URL simple
  if (u && !/^https?:\/\//i.test(u)) {
    return {
      ok: false,
      error: "L'URL doit commencer par http:// ou https://.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // RLS bloque l'insert si la campagne n'appartient pas à l'user.
  const { data: nextPos } = await supabase
    .from("campaign_examples")
    .select("position")
    .eq("campaign_id", campaignId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (nextPos?.position ?? -1) + 1;

  const { error } = await supabase.from("campaign_examples").insert({
    campaign_id: campaignId,
    url: u || null,
    caption: cap || null,
    position,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/opportunities/${campaignId}`);
  revalidatePath(`/c/${campaignId}`);
  return { ok: true };
}

/** Supprime un exemple. */
export async function removeCampaignExample(
  exampleId: string,
  campaignId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // `.select()` est ce qui rend le résultat LISIBLE. Sans lui, une suppression
  // refusée par la RLS — parce que l'exemple appartient à une autre marque —
  // renvoie `error: null` et zéro ligne : indiscernable d'un succès. L'écran
  // annonçait « supprimé », et l'exemple était toujours là au rechargement.
  const { data: supprimes, error } = await supabase
    .from("campaign_examples")
    .delete()
    .eq("id", exampleId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!supprimes || supprimes.length === 0)
    return {
      ok: false,
      error: "Cet exemple n'existe plus, ou il n'appartient pas à cette campagne.",
    };

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/opportunities/${campaignId}`);
  revalidatePath(`/c/${campaignId}`);
  return { ok: true };
}
