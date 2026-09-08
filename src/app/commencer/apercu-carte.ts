import type { BriefDefile } from "@/lib/defile";
import type { CarteMarque } from "@/lib/quiz";

/**
 * La carte du questionnaire, traduite en objet du défilé.
 *
 * ─── Pourquoi ce module existe ───
 * Il y avait DEUX rendus de carte : le vrai composant du défilé à l'étape du
 * visuel, et un aperçu maison sur l'écran de fin. Deux dessins pour une même
 * chose finissent toujours par diverger — et ils avaient divergé : la carte
 * qu'on venait de régler n'avait plus rien à voir avec celle du récapitulatif.
 *
 * Un seul constructeur, un seul composant. Ce que la marque voit à l'étape du
 * visuel est exactement ce qu'elle revoit à la fin, et exactement ce qu'un
 * créateur verra.
 */
export function apercuDeLaCarte(carte: CarteMarque): BriefDefile {
  const taux = carte.commission;
  return {
    id: "apercu",
    marque: carte.nom?.trim() || "Ta marque",
    produit: carte.produit,
    titre: carte.produit?.slice(0, 70) ?? null,
    exigences: null,
    echeance: carte.echeance,
    audienceMini: null,
    type: carte.remuneration === "commission" ? "affiliation" : carte.remuneration === "les-deux" ? "hybrid" : "video",
    montant: carte.montant,
    commission: taux !== null ? { min: taux, max: taux } : null,
    spots: null,
    niches: [],
    image: carte.logo,
    couleurMarque: carte.couleur,
    photos: carte.visuel ? [carte.visuel] : [],
    enseigne: carte.enseigne,
    enseigneSombre: carte.enseigneSombre,
    enseigneCarree: carte.enseigneCarree,
    modele: carte.modele,
    dejaInteressee: false,
  };
}

