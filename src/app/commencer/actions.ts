"use server";

import { identiteDeMarque, visuelsDeMarque } from "@/lib/identite-site";

export type IdentiteLue = {
  logo: string | null;
  couleur: string | null;
  photos: string[];
  /** L'enseigne officielle, en haute définition, quand la marque en a une. */
  enseigne: string | null;
  enseigneSombre: boolean;
  enseigneCarree: boolean;
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
/**
 * Rend ce que la promesse donne, ou la valeur de repli passé le délai.
 *
 * La promesse n'est pas annulée — on cesse simplement de l'attendre. Elle
 * finira dans le vide, ce qui est sans conséquence ici : rien n'est écrit.
 */
function avecPlafond<T>(promesse: Promise<T>, ms: number, repli: T): Promise<T> {
  return Promise.race([
    promesse.catch(() => repli),
    new Promise<T>((resoudre) => setTimeout(() => resoudre(repli), ms)),
  ]);
}

const VIDE: IdentiteLue = {
  logo: null,
  couleur: null,
  photos: [],
  enseigne: null,
  enseigneSombre: false,
  enseigneCarree: false,
};

export async function lireIdentiteMarque(site: string): Promise<IdentiteLue> {
  if (!site.trim()) return VIDE;
  const url = site.startsWith("http") ? site : `https://${site.trim()}`;
  try {
    // ⏱ Chaque branche a son plafond.
    //
    // Mesuré sur petitbateau.fr : douze secondes. Les deux essais de catalogue
    // (avec et sans « www ») expirent l'un après l'autre, et chacun attend son
    // propre délai. Personne ne doit patienter douze secondes pour apprendre
    // qu'on n'a rien trouvé — surtout pas au milieu d'un questionnaire.
    //
    // On plafonne plutôt que d'abandonner les deux : si les photos traînent
    // mais que l'identité est revenue, on garde l'identité.
    const [identite, photos] = await Promise.all([
      avecPlafond(identiteDeMarque(url), 8000, {
        logo: null,
        couleur: null,
        enseigne: null,
        enseigneSombre: false,
        enseigneCarree: false,
      }),
      avecPlafond(visuelsDeMarque(url), 8000, [] as string[]),
    ]);
    return {
      logo: identite.logo,
      couleur: identite.couleur,
      photos,
      enseigne: identite.enseigne,
      enseigneSombre: identite.enseigneSombre,
      enseigneCarree: identite.enseigneCarree,
    };
  } catch {
    return VIDE;
  }
}
