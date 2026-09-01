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
 * Pour ouvrir : poser `NEXT_PUBLIC_ALLOW_INDEXING=true` sur Vercel. Tout le
 * reste est déjà prêt — le plan du site, les directives ci-dessous et le
 * `llms.txt` servi par `app/llms.txt/route.ts` — et n'attend que ça.
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
      // ─── Les robots des moteurs de réponse, nommés un par un ───
      //
      // Ils ne sont pas couverts par le `*` : plusieurs ne l'appliquent que
      // s'ils ne trouvent pas de règle à leur nom, et certains éditeurs les
      // bloquent par défaut. Les nommer est une déclaration, pas une
      // redondance.
      //
      // Pourquoi c'est stratégique et pas cosmétique : quand quelqu'un demande
      // à une IA « quelle plateforme UGC utiliser en France », la réponse se
      // construit sur ce que ces robots ont pu lire. Collabstr — le concurrent
      // bootstrappé le plus avancé du secteur — les autorise nommément et leur
      // sert un `llms.txt`. Rester fermé, c'est être absent de la réponse.
      //
      // Les mêmes exclusions que ci-dessous s'appliquent : l'espace connecté
      // reste privé pour eux comme pour Google.
      ...AGENTS_IA.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVE,
      })),
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVE,
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}

/** Ce qui ne s'indexe jamais, quel que soit le robot. */
const PRIVE = [
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
  // Les liens d'affiliation sont des redirections : les indexer fausserait les
  // statistiques de clics et n'apporterait rien.
  "/r/",
];

/**
 * Les robots des moteurs de réponse et des modèles de langage.
 *
 * Liste tenue à la main plutôt que devinée : chacun de ces noms est celui
 * qu'un éditeur publie officiellement. En ajouter un inconnu ne sert à rien,
 * en oublier un connu revient à disparaître de son moteur.
 */
const AGENTS_IA = [
  "GPTBot",            // OpenAI, exploration pour l'entraînement
  "ChatGPT-User",      // OpenAI, lecture à la demande d'un utilisateur
  "OAI-SearchBot",     // OpenAI, index de recherche
  "ClaudeBot",         // Anthropic, exploration
  "Claude-User",       // Anthropic, lecture à la demande
  "anthropic-ai",      // Anthropic, ancien nom encore utilisé
  "PerplexityBot",     // Perplexity
  "Perplexity-User",   // Perplexity, lecture à la demande
  "Google-Extended",   // Google, autorisation distincte pour Gemini
  "Applebot-Extended", // Apple Intelligence
  "Meta-ExternalAgent",
  "cohere-ai",
  "CCBot",             // Common Crawl, qui alimente presque tous les autres
] as const;
