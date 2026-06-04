import "server-only";
import { createClient } from "@/lib/supabase/server";
import { OFFER_TYPES, type OfferId } from "@/components/landing/creators";

// Source de vérité = Supabase. Les démos seedées (is_demo) et les vrais
// inscrits qui ont complété leur profil apparaissent ici, sans distinction.

const OFFER_ORDER = OFFER_TYPES.map((o) => o.id) as OfferId[];

const TINTS = [
  "linear-gradient(135deg,#f9a8d4,#c084fc)",
  "linear-gradient(135deg,#67e8f9,#3b82f6)",
  "linear-gradient(135deg,#fdba74,#ec4899)",
  "linear-gradient(135deg,#fcd34d,#ef4444)",
  "linear-gradient(135deg,#c4b5fd,#e879f9)",
  "linear-gradient(135deg,#6ee7b7,#14b8a6)",
  "linear-gradient(135deg,#7dd3fc,#818cf8)",
  "linear-gradient(135deg,#86efac,#22d3ee)",
];
function tintFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}
function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
function priceFromRates(
  rateVideo: number | null,
  rateMention: number | null,
  ratePack: number | null,
): number | null {
  const rates = [rateVideo, rateMention, ratePack].filter(
    (v): v is number => v != null && v > 0,
  );
  return rates.length ? Math.min(...rates) : null;
}
function orderOffers(offers: string[]): OfferId[] {
  const set = new Set(offers);
  return OFFER_ORDER.filter((o) => set.has(o));
}

export type MarketplaceCreator = {
  id: string;
  name: string;
  handle: string;
  niche: string;
  platform: string;
  platformSlug: string;
  followers: string;
  engagement: string;
  priceFrom: number | null;
  offers: OfferId[];
  rating: number;
  photo: string;
  tint: string;
  niches: string[];
  platformLabels: string[];
  /** Signaux de qualité dérivés des données pour les badges sur la card. */
  isTop: boolean;
  isVerified: boolean;
  isNew: boolean;
  reviewsCount: number;
};

type CreatorRow = {
  id: string;
  handle: string | null;
  rating: number | null;
  engagement: number | null;
  rate_video: number | null;
  rate_mention: number | null;
  rate_pack: number | null;
  verified: boolean | null;
  deals_count: number | null;
  reviews_count: number | null;
  created_at: string | null;
};

async function loadRelations(ids: string[]) {
  const supabase = await createClient();
  const [profsRes, cpsRes, cnsRes, cosRes, platRes, nicheRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids),
    supabase
      .from("creator_platforms")
      .select("creator_id, platform_id, subscribers, handle, url")
      .in("creator_id", ids),
    supabase.from("creator_niches").select("creator_id, niche_id").in("creator_id", ids),
    supabase.from("creator_offers").select("creator_id, offer").in("creator_id", ids),
    supabase.from("platforms").select("id, label, slug"),
    supabase.from("niches").select("id, label"),
  ]);

  const platMap = new Map(
    (platRes.data ?? []).map((p) => [p.id, { label: p.label, slug: p.slug }]),
  );
  const nicheMap = new Map((nicheRes.data ?? []).map((n) => [n.id, n.label]));
  const profMap = new Map((profsRes.data ?? []).map((p) => [p.id, p]));

  const platsBy = new Map<
    string,
    { label: string; slug: string; subs: number; handle: string | null; url: string | null }[]
  >();
  for (const cp of cpsRes.data ?? []) {
    const p = platMap.get(cp.platform_id);
    if (!p) continue;
    const arr = platsBy.get(cp.creator_id) ?? [];
    arr.push({
      label: p.label,
      slug: p.slug,
      subs: cp.subscribers ?? 0,
      handle: cp.handle ?? null,
      url: cp.url ?? null,
    });
    platsBy.set(cp.creator_id, arr);
  }
  const nichesBy = new Map<string, string[]>();
  for (const cn of cnsRes.data ?? []) {
    const label = nicheMap.get(cn.niche_id);
    if (!label) continue;
    const arr = nichesBy.get(cn.creator_id) ?? [];
    arr.push(label);
    nichesBy.set(cn.creator_id, arr);
  }
  const offersBy = new Map<string, string[]>();
  for (const co of cosRes.data ?? []) {
    const arr = offersBy.get(co.creator_id) ?? [];
    arr.push(co.offer);
    offersBy.set(co.creator_id, arr);
  }

  return { profMap, platsBy, nichesBy, offersBy };
}

/** Carte marketplace : créateurs « complets » (photo, réseau, niche, offre). */
export async function getMarketplaceCreators(): Promise<MarketplaceCreator[]> {
  const supabase = await createClient();
  const { data: creators } = await supabase
    .from("creators")
    .select(
      "id, handle, rating, engagement, rate_video, rate_mention, rate_pack, verified, deals_count, reviews_count, created_at",
    )
    .order("rating", { ascending: false });
  const rows = (creators ?? []) as CreatorRow[];
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];

  const { profMap, platsBy, nichesBy, offersBy } = await loadRelations(ids);

  const NOW = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  const result: MarketplaceCreator[] = [];
  for (const c of rows) {
    const prof = profMap.get(c.id);
    const plats = (platsBy.get(c.id) ?? []).slice().sort((a, b) => b.subs - a.subs);
    const niches = nichesBy.get(c.id) ?? [];
    const offers = orderOffers(offersBy.get(c.id) ?? []);

    // Gating : un profil n'apparaît que s'il est complet.
    if (!c.handle || !prof?.avatar_url || plats.length === 0 || niches.length === 0 || offers.length === 0)
      continue;

    const main = plats[0];
    const rating = c.rating ?? 5;
    const dealsCount = c.deals_count ?? 0;
    const reviewsCount = c.reviews_count ?? 0;
    const verified = Boolean(c.verified);
    const createdMs = c.created_at ? new Date(c.created_at).getTime() : 0;
    const isNew = createdMs > 0 && NOW - createdMs < THIRTY_DAYS_MS;
    // "Top" = vétéran avec excellente note. Au moins 5 deals OU 5 reviews + note ≥ 4.8.
    const isTop = rating >= 4.8 && (dealsCount >= 5 || reviewsCount >= 5);

    result.push({
      id: c.id,
      name: prof.display_name ?? "Créateur",
      handle: c.handle,
      niche: niches[0],
      platform: main.label,
      platformSlug: main.slug,
      followers: fmtFollowers(main.subs),
      engagement: c.engagement != null ? `${c.engagement}%` : "—",
      priceFrom: priceFromRates(c.rate_video, c.rate_mention, c.rate_pack),
      offers,
      rating,
      photo: prof.avatar_url,
      tint: tintFor(c.handle),
      niches,
      platformLabels: plats.map((p) => p.label),
      isTop,
      isVerified: verified,
      isNew,
      reviewsCount,
    });
  }
  return result;
}

export type CreatorProfileData = {
  id: string;
  name: string;
  handle: string;
  bio: string | null;
  rating: number;
  reviewsCount: number;
  dealsCount: number;
  engagement: string;
  priceFrom: number | null;
  offers: OfferId[];
  photo: string | null;
  tint: string;
  niches: string[];
  platforms: { label: string; slug: string; followers: string; handle: string | null; url: string | null }[];
  mainPlatform: { label: string; slug: string } | null;
  totalFollowers: string;
  isTop: boolean;
  isVerified: boolean;
  isNew: boolean;
  portfolio: {
    id: string;
    url: string;
    title: string | null;
    thumbnailUrl: string | null;
    platformSlug: string | null;
    viewCount: number | null;
    durationSeconds: number | null;
    isShort: boolean;
  }[];
};

/** Profil public d'un créateur par son handle. */
export async function getCreatorByHandle(handle: string): Promise<CreatorProfileData | null> {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("creators")
    .select(
      "id, handle, bio, rating, reviews_count, deals_count, engagement, rate_video, rate_mention, rate_pack, verified, created_at",
    )
    .eq("handle", handle)
    .maybeSingle();
  if (!c) return null;

  const { profMap, platsBy, nichesBy, offersBy } = await loadRelations([c.id]);
  const prof = profMap.get(c.id);
  const plats = (platsBy.get(c.id) ?? []).slice().sort((a, b) => b.subs - a.subs);
  const totalSubs = plats.reduce((sum, p) => sum + p.subs, 0);

  // Portfolio (public via RLS). Trié par vues décroissantes pour montrer
  // d'abord les vidéos qui marchent le mieux (puis fallback sur position
  // pour les items sans stats).
  const { data: portfolioData } = await supabase
    .from("creator_portfolio_items")
    .select(
      "id, url, title, thumbnail_url, platform_slug, view_count, duration_seconds, is_short, position",
    )
    .eq("creator_id", c.id)
    .order("view_count", { ascending: false, nullsFirst: false })
    .order("position");

  const rating = c.rating ?? 5;
  const dealsCount = c.deals_count ?? 0;
  const reviewsCount = c.reviews_count ?? 0;
  const verified = Boolean(c.verified);
  const createdMs = c.created_at ? new Date(c.created_at).getTime() : 0;
  const NOW = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const isNew = createdMs > 0 && NOW - createdMs < THIRTY_DAYS_MS;
  const isTop = rating >= 4.8 && (dealsCount >= 5 || reviewsCount >= 5);

  return {
    id: c.id,
    name: prof?.display_name ?? "Créateur",
    handle: c.handle ?? handle,
    bio: c.bio,
    rating,
    reviewsCount,
    dealsCount,
    engagement: c.engagement != null ? `${c.engagement}%` : "—",
    priceFrom: priceFromRates(c.rate_video, c.rate_mention, c.rate_pack),
    offers: orderOffers(offersBy.get(c.id) ?? []),
    photo: prof?.avatar_url ?? null,
    tint: tintFor(c.handle ?? handle),
    niches: nichesBy.get(c.id) ?? [],
    platforms: plats.map((p) => ({
      label: p.label,
      slug: p.slug,
      followers: fmtFollowers(p.subs),
      handle: p.handle,
      url: p.url,
    })),
    mainPlatform: plats[0] ? { label: plats[0].label, slug: plats[0].slug } : null,
    totalFollowers: fmtFollowers(totalSubs),
    isTop,
    isVerified: verified,
    isNew,
    portfolio: (portfolioData ?? []).map((p) => ({
      id: p.id,
      url: p.url,
      title: p.title,
      thumbnailUrl: p.thumbnail_url,
      platformSlug: p.platform_slug,
      viewCount: p.view_count,
      durationSeconds: p.duration_seconds,
      isShort: p.is_short ?? false,
    })),
  };
}

export type CreatorReview = {
  brandName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

/** Avis publics reçus par un créateur (avec le nom de la marque). */
export async function getCreatorReviews(creatorId: string): Promise<CreatorReview[]> {
  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("brand_id, rating, comment, created_at")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });
  const rows = reviews ?? [];
  if (rows.length === 0) return [];

  const brandIds = [...new Set(rows.map((r) => r.brand_id))];
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name")
    .in("id", brandIds);
  const nameMap = new Map((brands ?? []).map((b) => [b.id, b.name]));

  return rows.map((r) => ({
    brandName: nameMap.get(r.brand_id) ?? "Marque",
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
  }));
}
