import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { SITE } from "@/lib/legal-entity";
import { ARTICLES } from "@/lib/blog";

/**
 * Plan du site.
 *
 * Ne liste que ce qui est réellement public et utile : la vitrine, les
 * documents légaux, et les fiches créateurs visibles. Les profils de
 * démonstration en sont exclus — les référencer reviendrait à demander aux
 * moteurs d'indexer des personnes qui n'existent pas.
 *
 * Tant que `NEXT_PUBLIC_ALLOW_INDEXING` n'est pas activé, `robots.ts` interdit
 * de toute façon l'exploration ; ce plan se prépare pour le jour de
 * l'ouverture.
 */
export const revalidate = 3600;


export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/creators`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // Le blog et ses articles. Priorité haute : ce sont les pages qui captent
    // une intention de recherche, donc celles par lesquelles un visiteur
    // arrive sans nous connaître.
    { url: `${SITE.url}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...ARTICLES.map((a) => ({
      url: `${SITE.url}/blog/${a.slug}`,
      lastModified: new Date(a.misAJourLe ?? a.publieLe),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${SITE.url}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/legal/mentions`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE.url}/legal/cgu`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE.url}/legal/cgv`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    {
      url: `${SITE.url}/legal/confidentialite`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  // Fiches créateurs — uniquement les vraies. Si la requête échoue, on renvoie
  // les pages statiques plutôt que rien : un plan partiel vaut mieux qu'une
  // erreur qui prive les moteurs de tout le site.
  let creatorPages: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("creators")
      .select("handle, updated_at, is_demo")
      .not("handle", "is", null)
      .neq("is_demo", true)
      .limit(5000);

    creatorPages = (data ?? []).map((c) => ({
      url: `${SITE.url}/creators/${c.handle}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // Plan partiel, volontairement silencieux.
  }

  return [...staticPages, ...creatorPages];
}
