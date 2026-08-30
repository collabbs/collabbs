import type { MetadataRoute } from "next";

/**
 * Manifeste d'application installable.
 *
 * Les créateurs vivent sur leur téléphone : pouvoir garder Collabbs sur
 * l'écran d'accueil, ouvert en plein écran, change la nature de l'outil — on
 * y revient chaque jour au lieu d'y aller quand on y pense.
 *
 * `start_url` pointe sur `/start`, qui aiguille selon le rôle : une marque
 * arrive sur les créateurs, un créateur sur les opportunités. Chacun ouvre
 * l'application là où son travail commence.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Collabbs — créateurs & marques",
    short_name: "Collabbs",
    description:
      "La marketplace qui connecte créateurs et marques : affiliation en 1 clic, collaborations, contrats et paiements sécurisés.",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "fr",
    dir: "ltr",
    background_color: "#ffffff",
    theme_color: "#7c3aed",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/collabbs-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/collabbs-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android rogne les bords jusqu'à 20 % : cette version porte sa marge.
      {
        src: "/icons/collabbs-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Mes collaborations", url: "/deals" },
      { name: "Messages", url: "/messages" },
    ],
  };
}
