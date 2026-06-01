import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreatorProfileForm from "./CreatorProfileForm";
import BrandProfileForm from "./BrandProfileForm";

export const metadata = {
  title: "Mon profil — Collabbs",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/dashboard");

  // ============ Branche CRÉATEUR ============
  if (profile.role === "creator") {
    const [nichesRes, platformsRes, creatorRes, cNichesRes, cPlatformsRes, cOffersRes] =
      await Promise.all([
        supabase.from("niches").select("id, label").order("label"),
        supabase.from("platforms").select("id, label, slug").order("id"),
        supabase
          .from("creators")
          .select("handle, bio, custom_niche")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("creator_niches").select("niche_id").eq("creator_id", user.id),
        supabase
          .from("creator_platforms")
          .select("platform_id, handle, subscribers, url")
          .eq("creator_id", user.id),
        supabase.from("creator_offers").select("offer, price").eq("creator_id", user.id),
      ]);

    // Si l'utilisateur n'a même pas commencé l'onboarding → on l'envoie sur le
    // wizard de création initiale (expérience guidée première fois).
    const hasStarted =
      Boolean(creatorRes.data?.handle) ||
      (cNichesRes.data ?? []).length > 0 ||
      (cOffersRes.data ?? []).length > 0;
    if (!hasStarted) redirect("/onboarding/creator");

    return (
      <CreatorProfileForm
        userId={user.id}
        displayName={profile.display_name ?? "Créateur"}
        niches={nichesRes.data ?? []}
        platforms={platformsRes.data ?? []}
        publicHandle={creatorRes.data?.handle ?? null}
        initial={{
          handle: creatorRes.data?.handle ?? "",
          bio: creatorRes.data?.bio ?? "",
          avatarUrl: profile.avatar_url ?? null,
          customNiche: creatorRes.data?.custom_niche ?? "",
          nicheIds: (cNichesRes.data ?? []).map((r) => r.niche_id),
          platforms: (cPlatformsRes.data ?? []).map((r) => ({
            platformId: r.platform_id,
            handle: r.handle ?? "",
            subs: r.subscribers != null ? String(r.subscribers) : "",
            url: r.url ?? "",
          })),
          offers: (cOffersRes.data ?? []).map((r) => ({
            offer: r.offer as string,
            price: r.price != null ? String(r.price) : "",
          })),
        }}
      />
    );
  }

  // ============ Branche MARQUE ============
  if (profile.role === "brand") {
    const [brandRes, nichesRes, platformsRes, bNichesRes, bPlatformsRes] =
      await Promise.all([
        supabase
          .from("brands")
          .select("name, sector, website, logo_url, description")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("niches").select("id, label").order("label"),
        supabase.from("platforms").select("id, label, slug").order("id"),
        supabase.from("brand_niches").select("niche_id").eq("brand_id", user.id),
        supabase
          .from("brand_platforms")
          .select("platform_id, handle, url")
          .eq("brand_id", user.id),
      ]);

    const brand = brandRes.data;
    const hasStarted = Boolean(brand?.name) && Boolean(brand?.logo_url);
    if (!hasStarted) redirect("/onboarding/brand");

    return (
      <BrandProfileForm
        userId={user.id}
        niches={nichesRes.data ?? []}
        platforms={platformsRes.data ?? []}
        initial={{
          name: brand?.name ?? profile.display_name ?? "",
          sector: brand?.sector ?? "",
          website: brand?.website ?? "",
          logoUrl: brand?.logo_url ?? null,
          description: brand?.description ?? "",
          nicheIds: (bNichesRes.data ?? []).map((r) => r.niche_id),
          platforms: (bPlatformsRes.data ?? []).map((r) => ({
            platformId: r.platform_id,
            handle: r.handle ?? "",
            url: r.url ?? "",
          })),
        }}
      />
    );
  }

  // Rôle inconnu → tableau de bord.
  redirect("/dashboard");
}
