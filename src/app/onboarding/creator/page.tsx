import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppOrLandingShell from "@/components/app/AppOrLandingShell";
import Wizard from "./Wizard";
import PortfolioManager from "@/app/(app)/profile/PortfolioManager";

export const metadata = {
  title: "Compléter mon profil — Collabbs",
};

export default async function CreatorOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    profileRes,
    nichesRes,
    platformsRes,
    creatorRes,
    creatorNichesRes,
    creatorPlatformsRes,
    creatorOffersRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, display_name, avatar_url")
      .eq("id", user.id)
      .single(),
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
    supabase
      .from("creator_offers")
      .select("offer, price")
      .eq("creator_id", user.id),
  ]);

  // Portfolio existant (en mode edit, l'user revoit ses items)
  const { data: portfolioData } = await supabase
    .from("creator_portfolio_items")
    .select(
      "id, url, title, thumbnail_url, platform_slug, view_count, like_count, duration_seconds, is_short",
    )
    .eq("creator_id", user.id)
    .order("position");

  // L'onboarding créateur n'est pertinent que pour les créateurs.
  if (profileRes.data?.role !== "creator") redirect("/dashboard");

  const initialNicheIds = (creatorNichesRes.data ?? []).map((r) => r.niche_id);
  const initialPlatforms = (creatorPlatformsRes.data ?? []).map((r) => ({
    platformId: r.platform_id,
    handle: r.handle ?? "",
    subs: r.subscribers != null ? String(r.subscribers) : "",
    url: r.url ?? "",
  }));
  const initialOffers = (creatorOffersRes.data ?? []).map((r) => ({
    offer: r.offer as string,
    price: r.price != null ? String(r.price) : "",
  }));

  // Édition vs création initiale : on bascule en mode édition dès qu'on
  // détecte qu'il y a déjà du contenu enregistré (handle, niches ou offres).
  const hasContent =
    Boolean(creatorRes.data?.handle) ||
    initialNicheIds.length > 0 ||
    initialOffers.length > 0;
  const mode: "create" | "edit" = hasContent ? "edit" : "create";

  // YouTube handle pré-rempli si renseigné dans creator_platforms
  const youtubePlatformId = (platformsRes.data ?? []).find(
    (p) => p.slug === "youtube",
  )?.id;
  const youtubeRow = (creatorPlatformsRes.data ?? []).find(
    (cp) => cp.platform_id === youtubePlatformId,
  );
  const defaultYouTube = youtubeRow?.url || youtubeRow?.handle || "";

  return (
    <AppOrLandingShell>
      <Wizard
        userId={user.id}
        displayName={profileRes.data?.display_name ?? "Créateur"}
        niches={nichesRes.data ?? []}
        platforms={platformsRes.data ?? []}
        mode={mode}
        portfolioSection={
          <PortfolioManager
            initial={portfolioData ?? []}
            defaultYouTubeHandle={defaultYouTube}
            publicHandle={creatorRes.data?.handle ?? null}
          />
        }
        initial={{
          handle: creatorRes.data?.handle ?? "",
          bio: creatorRes.data?.bio ?? "",
          avatarUrl: profileRes.data?.avatar_url ?? null,
          customNiche: creatorRes.data?.custom_niche ?? "",
          nicheIds: initialNicheIds,
          platforms: initialPlatforms,
          offers: initialOffers,
        }}
      />
    </AppOrLandingShell>
  );
}
