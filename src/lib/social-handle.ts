/**
 * Extrait un @handle depuis une URL de profil réseau social.
 *
 * Pourquoi : si le créateur colle l'URL de son compte, on évite de lui
 * demander aussi le @handle en double — on l'extrait. Si l'URL ne matche
 * aucun pattern, on renvoie null et le user remplit lui-même.
 *
 * Exemples :
 *   instagram.com/martindrn       → "martindrn"
 *   tiktok.com/@martin.drn        → "martin.drn"
 *   youtube.com/@MartinDRN        → "MartinDRN"
 *   youtu.be/UCxxxxxxx            → null (channel ID, pas un handle)
 *   x.com/martindrn               → "martindrn"
 */
export function extractHandleFromUrl(
  url: string,
  platformSlug?: string,
): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Patterns par plateforme. On normalise la casse pour youtube/insta/tiktok
  // (qui sont insensibles), mais on garde la casse d'origine pour Twitter/X
  // qui distingue (rare en pratique mais bon).
  const patterns: { test: RegExp; slug?: string }[] = [
    { test: /youtube\.com\/@([\w.-]+)/i, slug: "youtube" },
    { test: /youtube\.com\/c\/([\w.-]+)/i, slug: "youtube" },
    { test: /youtube\.com\/user\/([\w.-]+)/i, slug: "youtube" },
    { test: /instagram\.com\/([\w._]+)/i, slug: "instagram" },
    { test: /tiktok\.com\/@([\w._]+)/i, slug: "tiktok" },
    { test: /(?:twitter|x)\.com\/([\w._]+)/i, slug: "twitter" },
    { test: /twitch\.tv\/([\w._]+)/i, slug: "twitch" },
    { test: /facebook\.com\/([\w.-]+)/i, slug: "facebook" },
    { test: /linkedin\.com\/in\/([\w.-]+)/i, slug: "linkedin" },
    { test: /(?:pinterest\.com|pin\.it)\/([\w.-]+)/i, slug: "pinterest" },
    { test: /snapchat\.com\/add\/([\w._-]+)/i, slug: "snapchat" },
  ];

  for (const p of patterns) {
    // Si platformSlug est fourni, on privilégie le pattern correspondant
    // pour éviter qu'un lien instagram.com/p/... ne se fasse parser
    // par mégarde dans un autre cas.
    if (platformSlug && p.slug && p.slug !== platformSlug) continue;
    const m = trimmed.match(p.test);
    if (m && m[1]) {
      // Filtres : on rejette les segments qui ressemblent à des pages
      // génériques plutôt qu'à un handle (Insta `/p/`, `/reel/`, `/explore`).
      const candidate = m[1];
      if (["p", "reel", "explore", "stories", "tv"].includes(candidate.toLowerCase())) {
        return null;
      }
      // On retire un `?...` ou `#...` éventuel qui aurait été capturé.
      return candidate.split(/[?#]/)[0];
    }
  }

  return null;
}
