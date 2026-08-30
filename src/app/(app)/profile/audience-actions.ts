"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchChannelAudience } from "@/lib/youtube";

/**
 * Vérification d'audience.
 *
 * Un chiffre d'abonnés n'est « vérifié » que s'il vient de la plateforme
 * elle-même. Tout le reste est déclaratif, et doit être présenté comme tel.
 *
 * Aujourd'hui seul YouTube est vérifiable sans OAuth : son API expose le
 * nombre d'abonnés d'une chaîne publique. TikTok et Instagram exigent une
 * connexion du compte (validation Meta / ByteDance, plusieurs semaines) —
 * d'ici là, leurs chiffres restent explicitement déclaratifs.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const untyped = (c: unknown) => c as any;

/** Identifiant de la plateforme YouTube dans la table `platforms`. */
async function youtubePlatformId(supabase: any): Promise<number | null> {
  const { data } = await supabase
    .from("platforms")
    .select("id, slug")
    .eq("slug", "youtube")
    .maybeSingle();
  return data?.id ?? null;
}

export async function verifyYouTubeAudience(): Promise<{
  ok: boolean;
  error?: string;
  subscribers?: number;
  declared?: number | null;
  gapPct?: number | null;
}> {
  if (!process.env.YOUTUBE_API_KEY) {
    return {
      ok: false,
      error: "La vérification YouTube n'est pas configurée côté serveur.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const platformId = await youtubePlatformId(supabase);
  if (platformId === null) {
    return { ok: false, error: "Plateforme YouTube introuvable." };
  }

  const { data: row } = await untyped(supabase)
    .from("creator_platforms")
    .select("id, url, handle, subscribers")
    .eq("creator_id", user.id)
    .eq("platform_id", platformId)
    .maybeSingle();

  if (!row) {
    return {
      ok: false,
      error: "Ajoute d'abord ta chaîne YouTube dans tes réseaux.",
    };
  }

  const input = (row.url || row.handle || "").trim();
  if (!input) {
    return { ok: false, error: "Renseigne le lien de ta chaîne YouTube." };
  }

  let audience: Awaited<ReturnType<typeof fetchChannelAudience>>;
  try {
    audience = await fetchChannelAudience(input);
  } catch {
    return { ok: false, error: "YouTube n'a pas répondu. Réessaie dans un instant." };
  }
  if (!audience) {
    return {
      ok: false,
      error: "Chaîne introuvable. Vérifie le lien de ta chaîne YouTube.",
    };
  }
  if (audience.hiddenSubscriberCount) {
    return {
      ok: false,
      error:
        "Ton nombre d'abonnés est masqué sur YouTube. Rends-le public dans les paramètres de ta chaîne pour pouvoir le faire vérifier.",
    };
  }

  const declared = row.subscribers != null ? Number(row.subscribers) : null;
  const gapPct =
    declared && declared > 0
      ? Math.round(((declared - audience.subscribers) / declared) * 100)
      : null;

  const { error } = await untyped(supabase)
    .from("creator_platforms")
    .update({
      verified_subscribers: audience.subscribers,
      verified_at: new Date().toISOString(),
      verified_source: "youtube_api",
      platform_ref: audience.channelId,
      // Le chiffre affiché s'aligne sur le constat : c'est le principe même de
      // la vérification. Un créateur ne peut pas garder un chiffre déclaré plus
      // flatteur à côté d'un chiffre vérifié plus bas.
      subscribers: audience.subscribers,
    })
    .eq("id", row.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  revalidatePath("/creators");

  return { ok: true, subscribers: audience.subscribers, declared, gapPct };
}
