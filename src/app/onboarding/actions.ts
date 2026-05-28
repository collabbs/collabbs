"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OfferId } from "@/components/landing/creators";

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

  // Photo de profil (sur le profil)
  if (data.avatarUrl) {
    await supabase
      .from("profiles")
      .update({ avatar_url: data.avatarUrl })
      .eq("id", user.id);
  }

  // Profil créateur
  const { error: creatorErr } = await supabase
    .from("creators")
    .update({
      handle: data.handle || null,
      bio: data.bio || null,
      custom_niche: data.customNiche || null,
    })
    .eq("id", user.id);
  if (creatorErr) return { ok: false, error: creatorErr.message };

  // Niches (remplacement complet)
  await supabase.from("creator_niches").delete().eq("creator_id", user.id);
  if (data.niches.length > 0) {
    await supabase
      .from("creator_niches")
      .insert(data.niches.map((niche_id) => ({ creator_id: user.id, niche_id })));
  }

  // Réseaux (remplacement complet)
  await supabase.from("creator_platforms").delete().eq("creator_id", user.id);
  if (data.platforms.length > 0) {
    await supabase.from("creator_platforms").insert(
      data.platforms.map((p) => ({
        creator_id: user.id,
        platform_id: p.platformId,
        handle: p.handle || null,
        subscribers: p.subscribers,
        url: p.url || null,
      })),
    );
  }

  // Offres & tarifs (remplacement complet)
  await supabase.from("creator_offers").delete().eq("creator_id", user.id);
  if (data.offers.length > 0) {
    await supabase
      .from("creator_offers")
      .insert(
        data.offers.map((o) => ({ creator_id: user.id, offer: o.offer, price: o.price })),
      );
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export type BrandOnboardingData = {
  name: string;
  sector: string;
  website: string;
  logoUrl: string | null;
};

export async function saveBrandOnboarding(
  data: BrandOnboardingData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // La grille de commission se définit par campagne, pas ici.
  const { error } = await supabase
    .from("brands")
    .update({
      name: data.name,
      sector: data.sector || null,
      website: data.website || null,
      logo_url: data.logoUrl,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
