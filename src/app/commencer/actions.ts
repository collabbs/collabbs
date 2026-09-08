"use server";

import { identiteDeMarque, visuelsDeMarque } from "@/lib/identite-site";

export type IdentiteLue = {
  logo: string | null;
  couleur: string | null;
  photos: string[];
  /** L'enseigne officielle, en haute définition, quand la marque en a une. */
  enseigne: string | null;
  enseigneSombre: boolean;
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
const VIDE: IdentiteLue = {
  logo: null,
  couleur: null,
  photos: [],
  enseigne: null,
  enseigneSombre: false,
};

export async function lireIdentiteMarque(site: string): Promise<IdentiteLue> {
  if (!site.trim()) return VIDE;
  const url = site.startsWith("http") ? site : `https://${site.trim()}`;
  try {
    const [identite, photos] = await Promise.all([
      identiteDeMarque(url),
      visuelsDeMarque(url),
    ]);
    return {
      logo: identite.logo,
      couleur: identite.couleur,
      photos,
      enseigne: identite.enseigne,
      enseigneSombre: identite.enseigneSombre,
    };
  } catch {
    return VIDE;
  }
}
