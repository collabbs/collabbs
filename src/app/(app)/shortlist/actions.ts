"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Toggle un créateur dans la shortlist de la marque connectée.
 * Renvoie le nouvel état (saved: true/false).
 */
export async function toggleSavedCreator(
  creatorId: string,
): Promise<{ ok: boolean; saved?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "brand")
    return { ok: false, error: "Réservé aux marques." };

  const { data: existing } = await supabase
    .from("brand_creator_saves")
    .select("creator_id")
    .eq("brand_id", user.id)
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("brand_creator_saves")
      .delete()
      .eq("brand_id", user.id)
      .eq("creator_id", creatorId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/shortlist");
    revalidatePath("/creators");
    return { ok: true, saved: false };
  }

  const { error } = await supabase
    .from("brand_creator_saves")
    .insert({ brand_id: user.id, creator_id: creatorId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shortlist");
  revalidatePath("/creators");
  return { ok: true, saved: true };
}
