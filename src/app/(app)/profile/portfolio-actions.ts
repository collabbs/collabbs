"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Détecte le slug de la plateforme depuis une URL. */
function detectPlatform(url: string): string | null {
  const u = url.toLowerCase();
  if (/(?:tiktok\.com|vm\.tiktok\.com)/.test(u)) return "tiktok";
  if (/(?:instagram\.com|instagr\.am)/.test(u)) return "instagram";
  if (/(?:youtube\.com|youtu\.be)/.test(u)) return "youtube";
  if (/twitter\.com|x\.com/.test(u)) return "twitter";
  if (/twitch\.tv/.test(u)) return "twitch";
  if (/snapchat\.com/.test(u)) return "snapchat";
  if (/facebook\.com|fb\.com/.test(u)) return "facebook";
  if (/linkedin\.com/.test(u)) return "linkedin";
  return null;
}

export async function addPortfolioItem(
  url: string,
  title: string,
  thumbnailUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const u = url.trim();
  if (!u) return { ok: false, error: "L'URL est obligatoire." };
  if (!/^https?:\/\//i.test(u)) {
    return { ok: false, error: "L'URL doit commencer par http:// ou https://." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: nextPos } = await supabase
    .from("creator_portfolio_items")
    .select("position")
    .eq("creator_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (nextPos?.position ?? -1) + 1;

  const { error } = await supabase.from("creator_portfolio_items").insert({
    creator_id: user.id,
    url: u,
    title: title.trim() || null,
    thumbnail_url: thumbnailUrl.trim() || null,
    platform_slug: detectPlatform(u),
    position,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true };
}

export async function removePortfolioItem(
  itemId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { error } = await supabase
    .from("creator_portfolio_items")
    .delete()
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true };
}
