"use server";

import { revalidatePath } from "next/cache";
import { echecEcriture } from "@/lib/echec-ecriture";
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
  /* Converti une fois, ici : une action serveur est une adresse HTTP publique
     et le type annoncé dans la signature n'est qu'une promesse du client. Un
     corps de requête portant autre chose qu'une chaîne faisait planter l'action
     sur « .trim is not a function » — une erreur non rattrapée, au lieu du
     contrôle écrit juste après. */
  const u = String(url ?? "").trim();
  const titre = String(title ?? "").trim();
  const vignette = String(thumbnailUrl ?? "").trim();
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
    title: titre || null,
    thumbnail_url: vignette || null,
    platform_slug: detectPlatform(u),
    position,
  });
  if (error)
    return {
      ok: false,
      error: await echecEcriture("portfolio/ajout", error, "Ce contenu n'a pas pu être ajouté à ton portfolio. Réessaie."),
    };

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

  // Même piège qu'ailleurs : la RLS restreint la suppression au propriétaire,
  // mais un refus ne produit pas d'erreur — zéro ligne, `error: null`. Sans
  // lire les lignes touchées, le créateur voyait « supprimé » sur un contenu
  // qui revenait au rechargement.
  const { data: supprimes, error } = await supabase
    .from("creator_portfolio_items")
    .delete()
    .eq("id", itemId)
    .select("id");
  if (error)
    return {
      ok: false,
      error: await echecEcriture("portfolio/retrait", error, "Ce contenu n'a pas pu être retiré. Réessaie."),
    };
  if (!supprimes || supprimes.length === 0)
    return { ok: false, error: "Ce contenu n'existe plus, ou il ne t'appartient pas." };

  revalidatePath("/profile");
  return { ok: true };
}
