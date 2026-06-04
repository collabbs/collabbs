import type { NextConfig } from "next";

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
};

export default nextConfig;
