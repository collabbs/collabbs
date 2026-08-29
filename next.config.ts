import type { NextConfig } from "next";

/**
 * En-têtes de sécurité.
 *
 * Collabbs manipule de l'argent et des coordonnées légales : ces en-têtes
 * ferment des portes qui, par défaut, restent ouvertes.
 *
 * Une exception assumée : `/track.js` et les routes de suivi doivent rester
 * appelables depuis les boutiques des marques, donc depuis d'autres domaines.
 * Elles sont traitées à part, plus bas.
 */
const SECURITY_HEADERS = [
  {
    // Empêche l'affichage du site dans une iframe tierce, et donc le
    // détournement de clic : une page malveillante qui superpose un bouton
    // invisible au-dessus de « Verser au créateur ».
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Interdit au navigateur de deviner le type d'un fichier servi. Sans ça,
    // un fichier déposé par un créateur pourrait être interprété comme du
    // script.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // N'expose l'URL complète qu'aux navigations internes ; les sites tiers
    // ne reçoivent que le domaine. Nos URL contiennent des identifiants de
    // collaboration et de contrat.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Force HTTPS pendant deux ans, sous-domaines compris.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Aucune de ces capacités n'est utilisée par le produit : on les refuse
    // plutôt que de laisser la porte entrouverte.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    // Isole le contexte de navigation : une fenêtre ouverte depuis un site
    // tiers ne peut plus manipuler la nôtre.
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos de profil envoyées via FormData côté server action.
      // Default Next.js = 1MB → trop bas pour une photo téléphone moderne
      // (souvent 3-8 MB). On bump à 10MB. Le client compresse de toute
      // façon en amont pour rester bien en-dessous, mais cette borne sert
      // de filet de sécurité.
      bodySizeLimit: "10mb",
    },
  },

  async headers() {
    return [
      {
        // Tout le site, sauf les points d'entrée destinés aux boutiques.
        source: "/((?!api/track|track\\.js).*)",
        headers: SECURITY_HEADERS,
      },
      {
        // Le script de suivi est fait pour être chargé depuis les sites des
        // marques : il lui faut l'autorisation d'origine croisée, et surtout
        // pas `X-Frame-Options`.
        source: "/track.js",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          // Le script change rarement ; une heure de cache évite de le
          // recharger à chaque page vue d'une boutique.
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        // Les routes de suivi reçoivent des appels serveur-à-serveur et des
        // pixels depuis les boutiques : même logique.
        source: "/api/track/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
