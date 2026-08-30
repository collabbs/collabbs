import type { MetadataRoute } from "next";
import { SITE } from "@/lib/legal-entity";

/**
 * Directives d'indexation.
 *
 * Deux régimes, pilotés par `NEXT_PUBLIC_ALLOW_INDEXING` :
 *
 *  - **Avant l'ouverture (défaut)** — tout est interdit aux moteurs. Le site
 *    est en ligne et accessible à qui a l'adresse, mais il contient encore
 *    24 profils de démonstration et des compteurs qui ne reflètent aucune
 *    réalité. Les laisser s'indexer laisserait des traces durables : une page
 *    désindexée reste des mois dans les caches et les captures.
 *
 *  - **Après l'ouverture** — les pages publiques s'indexent, l'espace connecté
 *    et les points d'entrée techniques restent fermés.
 *
 * Pour ouvrir : poser `NEXT_PUBLIC_ALLOW_INDEXING=true` sur Vercel.
 */
const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

export default function robots(): MetadataRoute.Robots {
  if (!ALLOW_INDEXING) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Espace connecté : rien à y indexer, et tout y est privé.
          "/dashboard",
          "/deals",
          "/contracts",
          "/messages",
          "/campaigns",
          "/opportunities",
          "/activity",
          "/analytics",
          "/payouts",
          "/billing",
          "/tracking",
          "/shortlist",
          "/profile",
          "/settings",
          "/notifications",
          "/admin",
          "/invoices",
          "/start",
          // Points d'entrée techniques.
          "/api/",
          "/auth/",
          // Les liens d'affiliation sont des redirections : les indexer
          // fausserait les statistiques de clics et n'apporterait rien.
          "/r/",
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
