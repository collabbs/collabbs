"use server";

import { identiteDuSite, visuelsDeMarque } from "@/lib/identite-site";

export type IdentiteLue = {
  logo: string | null;
  couleur: string | null;
  photos: string[];
};

/**
 * Lit l'identité visuelle d'une marque à partir de son adresse.
 *
 * Appelée pendant le questionnaire, quand la marque sort du champ « site ».
 * L'intérêt n'est pas seulement technique : elle voit son logo et ses photos
 * apparaître sur sa carte pendant qu'elle répond. C'est le moment où le
 * questionnaire cesse d'être un formulaire et devient un aperçu.
 *
 * Ne lève jamais. Une marque dont le site ne répond pas doit pouvoir
 * continuer : la carte retombe sur son traitement graphique, et personne
 * n'est bloqué par un site lent.
 */
export async function lireIdentiteMarque(site: string): Promise<IdentiteLue> {
  if (!site.trim()) return { logo: null, couleur: null, photos: [] };
  const url = site.startsWith("http") ? site : `https://${site.trim()}`;
  try {
    const [identite, photos] = await Promise.all([
      identiteDuSite(url),
      visuelsDeMarque(url),
    ]);
    return { logo: identite.image, couleur: identite.couleur, photos };
  } catch {
    return { logo: null, couleur: null, photos: [] };
  }
}
