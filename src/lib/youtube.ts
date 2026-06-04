import "server-only";

/**
 * Wrapper minimaliste autour de YouTube Data API v3.
 * Coût en quota (10 000 unités/jour gratuits) :
 * - resolveChannelId : 1-2 unités (forHandle + fallback forUsername)
 * - fetchRecentVideos : 2 unités (channels.contentDetails + playlistItems)
 * → ~3 unités par import utilisateur. Soit ~3 300 imports/jour gratuits.
 *
 * On ne stocke aucun token utilisateur (pas d'OAuth) — c'est de la
 * lecture de données publiques avec une API key serveur.
 */

const API_BASE = "https://www.googleapis.com/youtube/v3";

export type YouTubeVideo = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  url: string;
  viewCount: number | null;
  likeCount: number | null;
  durationSeconds: number | null;
  isShort: boolean;
};

/** PT1H2M3S → 3723. Tolère M ou S manquants. */
function parseISO8601Duration(s: string): number {
  const m = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (
    parseInt(m[1] ?? "0", 10) * 3600 +
    parseInt(m[2] ?? "0", 10) * 60 +
    parseInt(m[3] ?? "0", 10)
  );
}

function apiKey(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) {
    throw new Error(
      "YOUTUBE_API_KEY manquante. Pose-la dans .env.local et sur Vercel.",
    );
  }
  return k;
}

/**
 * Tente de résoudre un input utilisateur (URL, @handle, channel ID brut)
 * vers un channel ID YouTube (UC...).
 * Retourne null si introuvable.
 */
export async function resolveChannelId(input: string): Promise<string | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Si l'input contient un channel ID (UC + 22 chars), on l'extrait direct
  const ucMatch = trimmed.match(/UC[a-zA-Z0-9_-]{22}/);
  if (ucMatch) return ucMatch[0];

  // 2. Extract handle from URL or use directly
  let handle: string | null = null;
  const urlHandleMatch = trimmed.match(/youtube\.com\/@([a-zA-Z0-9._-]+)/i);
  if (urlHandleMatch) {
    handle = urlHandleMatch[1];
  } else if (trimmed.startsWith("@")) {
    handle = trimmed.slice(1);
  } else if (!trimmed.includes("/")) {
    // L'user a tapé juste un nom
    handle = trimmed.replace(/^@/, "");
  }
  if (!handle) return null;

  const key = apiKey();

  // 3. Resolve via forHandle (handles modernes 2023+)
  const r1 = await fetch(
    `${API_BASE}/channels?part=id&forHandle=@${encodeURIComponent(handle)}&key=${key}`,
    { cache: "no-store" },
  );
  if (r1.ok) {
    const d1 = await r1.json();
    if (d1.items?.[0]?.id) return d1.items[0].id;
  }

  // 4. Fallback : forUsername (anciens channels legacy)
  const r2 = await fetch(
    `${API_BASE}/channels?part=id&forUsername=${encodeURIComponent(handle)}&key=${key}`,
    { cache: "no-store" },
  );
  if (r2.ok) {
    const d2 = await r2.json();
    if (d2.items?.[0]?.id) return d2.items[0].id;
  }

  return null;
}

/**
 * Récupère les N dernières vidéos publiques d'un channel.
 * Stratégie en 2 étapes (pas 1 search) pour économiser le quota :
 *   - channels.list?part=contentDetails (1 unité) → uploadsPlaylistId
 *   - playlistItems.list?part=snippet (1 unité) → liste des vidéos
 */
export async function fetchRecentVideos(
  channelId: string,
  max = 10,
): Promise<YouTubeVideo[]> {
  const key = apiKey();

  const ch = await fetch(
    `${API_BASE}/channels?part=contentDetails&id=${channelId}&key=${key}`,
    { cache: "no-store" },
  );
  if (!ch.ok) return [];
  const chData = await ch.json();
  const uploads =
    chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
  if (!uploads) return [];

  const pl = await fetch(
    `${API_BASE}/playlistItems?part=snippet&playlistId=${uploads}&maxResults=${max}&key=${key}`,
    { cache: "no-store" },
  );
  if (!pl.ok) return [];
  const plData = await pl.json();

  type Item = {
    snippet?: {
      title?: string;
      resourceId?: { videoId?: string };
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
        maxres?: { url?: string };
      };
    };
  };

  const items = (plData.items ?? []) as Item[];
  const baseVideos = items
    .map((it) => {
      const sn = it.snippet;
      const videoId = sn?.resourceId?.videoId ?? null;
      if (!videoId) return null;
      const thumb =
        sn?.thumbnails?.maxres?.url ??
        sn?.thumbnails?.high?.url ??
        sn?.thumbnails?.medium?.url ??
        sn?.thumbnails?.default?.url ??
        "";
      return {
        videoId,
        title: sn?.title ?? "",
        thumbnailUrl: thumb,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    })
    .filter((v): v is { videoId: string; title: string; thumbnailUrl: string; url: string } => v !== null);

  if (baseVideos.length === 0) return [];

  // Enrichit avec stats + durée (1 unité de quota pour le batch).
  // videos.list accepte jusqu'à 50 ids comma-separated.
  const videoIds = baseVideos.map((v) => v.videoId).join(",");
  const statsRes = await fetch(
    `${API_BASE}/videos?part=statistics,contentDetails&id=${videoIds}&key=${key}`,
    { cache: "no-store" },
  );
  type StatsItem = {
    id: string;
    statistics?: { viewCount?: string; likeCount?: string };
    contentDetails?: { duration?: string };
  };
  const statsById = new Map<
    string,
    { views: number | null; likes: number | null; durSec: number | null }
  >();
  if (statsRes.ok) {
    const statsData = await statsRes.json();
    for (const it of (statsData.items ?? []) as StatsItem[]) {
      const views = it.statistics?.viewCount
        ? Number(it.statistics.viewCount)
        : null;
      const likes = it.statistics?.likeCount
        ? Number(it.statistics.likeCount)
        : null;
      const durSec = it.contentDetails?.duration
        ? parseISO8601Duration(it.contentDetails.duration)
        : null;
      statsById.set(it.id, { views, likes, durSec });
    }
  }

  return baseVideos.map((v) => {
    const s = statsById.get(v.videoId);
    const durationSeconds = s?.durSec ?? null;
    return {
      ...v,
      viewCount: s?.views ?? null,
      likeCount: s?.likes ?? null,
      durationSeconds,
      isShort: durationSeconds != null && durationSeconds <= 60,
    };
  });
}
