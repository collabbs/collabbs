"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveChannelId, fetchRecentVideos } from "@/lib/youtube";

/**
 * Importe les 10 dernières vidéos publiques d'un channel YouTube
 * directement dans le portfolio du créateur connecté.
 *
 * Évite les doublons (par URL exacte). Position auto = max + 1.
 */
export async function importYouTubeVideos(
  input: string,
): Promise<{ ok: boolean; error?: string; imported?: number }> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "URL ou @handle YouTube requis." };

  if (!process.env.YOUTUBE_API_KEY) {
    return {
      ok: false,
      error:
        "L'import YouTube n'est pas encore configuré côté serveur. Reviens plus tard.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  let channelId: string | null = null;
  try {
    channelId = await resolveChannelId(trimmed);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Erreur côté API YouTube.",
    };
  }
  if (!channelId) {
    return {
      ok: false,
      error:
        "Channel YouTube introuvable. Vérifie le @handle ou l'URL de la chaîne.",
    };
  }

  let videos;
  try {
    videos = await fetchRecentVideos(channelId, 10);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Erreur côté API YouTube.",
    };
  }
  if (videos.length === 0) {
    return { ok: false, error: "Aucune vidéo publique trouvée sur cette chaîne." };
  }

  // Évite les doublons (par URL exacte)
  const { data: existing } = await supabase
    .from("creator_portfolio_items")
    .select("url")
    .eq("creator_id", user.id);
  const existingUrls = new Set((existing ?? []).map((e) => e.url));
  const toInsert = videos.filter((v) => !existingUrls.has(v.url));
  if (toInsert.length === 0) {
    return {
      ok: false,
      error: "Toutes ces vidéos sont déjà dans ton portfolio.",
    };
  }

  // Position auto = max existant + 1
  const { data: maxPos } = await supabase
    .from("creator_portfolio_items")
    .select("position")
    .eq("creator_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let pos = (maxPos?.position ?? -1) + 1;

  const rows = toInsert.map((v) => ({
    creator_id: user.id,
    url: v.url,
    title: v.title || null,
    thumbnail_url: v.thumbnailUrl || null,
    platform_slug: "youtube",
    position: pos++,
  }));

  const { error } = await supabase
    .from("creator_portfolio_items")
    .insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  // Si le créateur a un handle, sa fiche publique change aussi
  const { data: creator } = await supabase
    .from("creators")
    .select("handle")
    .eq("id", user.id)
    .maybeSingle();
  if (creator?.handle) revalidatePath(`/creators/${creator.handle}`);

  return { ok: true, imported: toInsert.length };
}
