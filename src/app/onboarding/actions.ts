"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OfferId } from "@/components/landing/creators";

/**
 * Upload d'avatar / logo côté SERVEUR.
 *
 * Pourquoi pas en direct côté browser ? Le client Supabase browser propage
 * mal la session JWT vers Storage dans certains cas (cookies SSR), ce qui
 * faisait planter l'upload en 400 (RLS — auth.uid() vu comme NULL). Côté
 * serveur, on a une session vérifiée propre via @supabase/ssr → l'upload
 * passe systématiquement.
 *
 * Le paramètre `kind` choisit le préfixe de fichier ("avatar" ou "logo").
 * On garde le même bucket "avatars" pour les deux : c'est public en lecture
 * et la policy RLS ne distingue pas (juste foldername = auth.uid()).
 */
export async function uploadAvatar(
  formData: FormData,
  kind: "avatar" | "logo" = "avatar",
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Aucun fichier reçu." };
  }
  if (file.size === 0) {
    return { ok: false, error: "Fichier vide." };
  }
  // 5 MB max — large mais évite des uploads abusifs depuis un mobile photo brute.
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "L'image fait plus de 5 Mo. Compresse-la et réessaie." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Format non supporté — utilise une image (JPG, PNG, WEBP)." };
  }

  // Vérification d'identité avec le client SSR (lecture du cookie session).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeExt = ext.length > 0 && ext.length <= 5 ? ext : "jpg";
  // Path verrouillé sur l'user.id authentifié → impossible d'écrire dans le
  // dossier d'un autre user via cette action.
  const path = `${user.id}/${kind}.${safeExt}`;

  // L'upload lui-même est fait avec le client admin (service-role) qui
  // bypass RLS. Pourquoi : le client SSR @supabase/ssr ne propage pas
  // toujours le JWT vers Storage (constaté en prod, 400 RLS systématique
  // même avec session OK). Comme l'identité a déjà été vérifiée et le path
  // verrouillé sur user.id juste au-dessus, c'est safe.
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
  if (upErr) {
    console.error("uploadAvatar: storage upload failed", upErr);
    return { ok: false, error: upErr.message };
  }

  const { data } = admin.storage.from("avatars").getPublicUrl(path);
  // ?v=timestamp pour invalider le cache CDN si l'image change.
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
}

export type OnboardingData = {
  handle: string;
  bio: string;
  avatarUrl: string | null;
  customNiche: string;
  niches: number[];
  platforms: {
    platformId: number;
    handle: string;
    subscribers: number | null;
    url: string;
  }[];
  offers: { offer: OfferId; price: number | null }[];
};

export async function saveCreatorOnboarding(
  data: OnboardingData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // Photo de profil (sur le profil). On log si ça échoue mais on ne bloque pas :
  // l'utilisateur peut avoir voulu juste mettre à jour ses infos sans photo.
  if (data.avatarUrl) {
    const { error: profErr } = await supabase
      .from("profiles")
      .update({ avatar_url: data.avatarUrl })
      .eq("id", user.id);
    if (profErr) {
      console.error("saveCreatorOnboarding: profile avatar update failed", profErr);
    }
  }

  // Profil créateur — UPSERT pour être robuste si la row n'a pas été créée
  // par le trigger handle_new_user (rare mais possible en cas de signup
  // historique avant que le trigger ne soit en place).
  const { error: creatorErr } = await supabase
    .from("creators")
    .upsert(
      {
        id: user.id,
        handle: data.handle || null,
        bio: data.bio || null,
        custom_niche: data.customNiche || null,
      },
      { onConflict: "id" },
    );
  if (creatorErr) {
    console.error("saveCreatorOnboarding: creators upsert failed", creatorErr);
    return { ok: false, error: `Profil créateur : ${creatorErr.message}` };
  }

  // Niches (remplacement complet)
  const { error: nichesDelErr } = await supabase
    .from("creator_niches")
    .delete()
    .eq("creator_id", user.id);
  if (nichesDelErr) {
    console.error("saveCreatorOnboarding: niches delete failed", nichesDelErr);
    return { ok: false, error: `Niches : ${nichesDelErr.message}` };
  }
  if (data.niches.length > 0) {
    const { error: nichesInsErr } = await supabase
      .from("creator_niches")
      .insert(data.niches.map((niche_id) => ({ creator_id: user.id, niche_id })));
    if (nichesInsErr) {
      console.error("saveCreatorOnboarding: niches insert failed", nichesInsErr);
      return { ok: false, error: `Niches : ${nichesInsErr.message}` };
    }
  }

  // Réseaux (remplacement complet)
  const { error: platDelErr } = await supabase
    .from("creator_platforms")
    .delete()
    .eq("creator_id", user.id);
  if (platDelErr) {
    console.error("saveCreatorOnboarding: platforms delete failed", platDelErr);
    return { ok: false, error: `Réseaux : ${platDelErr.message}` };
  }
  if (data.platforms.length > 0) {
    const { error: platInsErr } = await supabase.from("creator_platforms").insert(
      data.platforms.map((p) => ({
        creator_id: user.id,
        platform_id: p.platformId,
        handle: p.handle || null,
        subscribers: p.subscribers,
        url: p.url || null,
      })),
    );
    if (platInsErr) {
      console.error("saveCreatorOnboarding: platforms insert failed", platInsErr);
      return { ok: false, error: `Réseaux : ${platInsErr.message}` };
    }
  }

  // Offres & tarifs (remplacement complet)
  const { error: offDelErr } = await supabase
    .from("creator_offers")
    .delete()
    .eq("creator_id", user.id);
  if (offDelErr) {
    console.error("saveCreatorOnboarding: offers delete failed", offDelErr);
    return { ok: false, error: `Offres : ${offDelErr.message}` };
  }
  if (data.offers.length > 0) {
    const { error: offInsErr } = await supabase
      .from("creator_offers")
      .insert(
        data.offers.map((o) => ({ creator_id: user.id, offer: o.offer, price: o.price })),
      );
    if (offInsErr) {
      console.error("saveCreatorOnboarding: offers insert failed", offInsErr);
      return { ok: false, error: `Offres : ${offInsErr.message}` };
    }
  }

  // Invalider toutes les pages qui dépendent du profil créateur.
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/onboarding/creator");
  revalidatePath("/creators");
  if (data.handle) revalidatePath(`/creators/${data.handle}`);
  return { ok: true };
}

export type BrandOnboardingData = {
  name: string;
  sector: string;
  website: string;
  logoUrl: string | null;
  description?: string;
  niches?: number[];
  platforms?: {
    platformId: number;
    handle: string;
    url: string;
  }[];
};

export async function saveBrandOnboarding(
  data: BrandOnboardingData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // UPSERT pour la même raison que côté créateur — robuste si la row n'existe pas.
  const { error: brandErr } = await supabase
    .from("brands")
    .upsert(
      {
        id: user.id,
        name: data.name,
        sector: data.sector || null,
        website: data.website || null,
        logo_url: data.logoUrl,
        description: data.description?.trim() || null,
      },
      { onConflict: "id" },
    );
  if (brandErr) {
    console.error("saveBrandOnboarding: brands upsert failed", brandErr);
    return { ok: false, error: `Profil marque : ${brandErr.message}` };
  }

  // Niches ciblées (remplacement complet)
  if (data.niches) {
    const { error: delErr } = await supabase
      .from("brand_niches")
      .delete()
      .eq("brand_id", user.id);
    if (delErr) {
      console.error("saveBrandOnboarding: niches delete failed", delErr);
      return { ok: false, error: `Niches ciblées : ${delErr.message}` };
    }
    if (data.niches.length > 0) {
      const { error: insErr } = await supabase
        .from("brand_niches")
        .insert(data.niches.map((niche_id) => ({ brand_id: user.id, niche_id })));
      if (insErr) {
        console.error("saveBrandOnboarding: niches insert failed", insErr);
        return { ok: false, error: `Niches ciblées : ${insErr.message}` };
      }
    }
  }

  // Réseaux propres de la marque (remplacement complet)
  if (data.platforms) {
    const { error: delErr } = await supabase
      .from("brand_platforms")
      .delete()
      .eq("brand_id", user.id);
    if (delErr) {
      console.error("saveBrandOnboarding: platforms delete failed", delErr);
      return { ok: false, error: `Réseaux : ${delErr.message}` };
    }
    if (data.platforms.length > 0) {
      const { error: insErr } = await supabase.from("brand_platforms").insert(
        data.platforms.map((p) => ({
          brand_id: user.id,
          platform_id: p.platformId,
          handle: p.handle || null,
          url: p.url || null,
        })),
      );
      if (insErr) {
        console.error("saveBrandOnboarding: platforms insert failed", insErr);
        return { ok: false, error: `Réseaux : ${insErr.message}` };
      }
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/onboarding/brand");
  revalidatePath(`/brands/${user.id}`);
  return { ok: true };
}
