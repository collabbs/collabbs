import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreatorProfileForm from "./CreatorProfileForm";
import BrandProfileForm from "./BrandProfileForm";
import LegalInfoSection from "./LegalInfoSection";
import PortfolioManager from "./PortfolioManager";
import type { LegalInfoData } from "./legal-utils";

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

  // Infos légales (commun aux 2 rôles, on les charge ici pour réutiliser)
  const { data: legal } = await supabase
    .from("legal_info")
    .select(
      "status, legal_name, rep_name, address, city, zip, country, siret, vat, contact_email",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const legalInitial: LegalInfoData = {
    status: legal?.status ?? "",
    legalName: legal?.legal_name ?? "",
    repName: legal?.rep_name ?? "",
    address: legal?.address ?? "",
    city: legal?.city ?? "",
    zip: legal?.zip ?? "",
    country: legal?.country ?? "France",
    siret: legal?.siret ?? "",
    vat: legal?.vat ?? "",
    contactEmail: legal?.contact_email ?? "",
  };

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

    const { data: portfolioData } = await supabase
      .from("creator_portfolio_items")
      .select(
        "id, url, title, thumbnail_url, platform_slug, view_count, like_count, duration_seconds, is_short",
      )
      .eq("creator_id", user.id)
      .order("position");
    const portfolio = portfolioData ?? [];

    // Si l'user a renseigné un compte YouTube dans creator_platforms,
    // on pré-remplit la modale d'import avec son @handle ou URL.
    const youtubePlatformId = (platformsRes.data ?? []).find(
      (p) => p.slug === "youtube",
    )?.id;
    const youtubeRow = (cPlatformsRes.data ?? []).find(
      (cp) => cp.platform_id === youtubePlatformId,
    );
    const defaultYouTube = youtubeRow?.url || youtubeRow?.handle || "";

    // Note : on NE redirige PAS vers le wizard, même si tout est vide.
    // /profile doit toujours afficher les 5 sections complètes. L'utilisateur
    // remplit dans l'ordre qu'il veut. Le wizard /onboarding/* reste accessible
    // pour ceux qui veulent l'expérience guidée première fois.

    return (
      <CreatorProfileForm
        userId={user.id}
        displayName={profile.display_name ?? "Créateur"}
        niches={nichesRes.data ?? []}
        platforms={platformsRes.data ?? []}
        publicHandle={creatorRes.data?.handle ?? null}
        legalSection={<LegalInfoSection initial={legalInitial} role="creator" />}
        portfolioSection={
          <PortfolioManager
            initial={portfolio}
            defaultYouTubeHandle={defaultYouTube}
            publicHandle={creatorRes.data?.handle ?? null}
          />
        }
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
    // Pas de redirect : /profile montre toujours toutes les sections.
    // Le wizard /onboarding/brand reste accessible pour la première fois.

    return (
      <BrandProfileForm
        userId={user.id}
        niches={nichesRes.data ?? []}
        platforms={platformsRes.data ?? []}
        legalSection={<LegalInfoSection initial={legalInitial} role="brand" />}
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
