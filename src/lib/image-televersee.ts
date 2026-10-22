import "server-only";
import { formatImage, TYPE_SERVI, type FormatImage } from "@/lib/dimensions-image";

/**
 * Le contrôle commun aux trois dépôts d'image.
 *
 * Il y en avait trois copies — avatar, visuel de campagne, visuel anonyme —
 * et les trois faisaient la même erreur : croire le type MIME et le nom de
 * fichier envoyés par le client. Une seule implémentation, pour qu'elles ne
 * puissent plus diverger, et un seul endroit à corriger le jour où un format
 * s'ajoute.
 *
 * Ce qui en sort est sûr par construction : l'extension et le type servi sont
 * déduits des OCTETS, pas de ce qu'on nous a dit.
 */

/** 5 Mo : large pour une photo, trop petit pour servir d'hébergement. */
export const TAILLE_MAX = 5 * 1024 * 1024;

const FORMATS_LISIBLES = "JPG, PNG, GIF, WebP ou AVIF";

export type ImageValidee = {
  octets: Uint8Array;
  format: FormatImage;
  /** Extension à employer dans le chemin de stockage. */
  ext: string;
  /** Type à déclarer au stockage, déduit du format réel. */
  type: string;
};

export async function validerImage(
  valeur: FormDataEntryValue | null,
): Promise<{ ok: true; image: ImageValidee } | { ok: false; error: string }> {
  if (!(valeur instanceof File)) return { ok: false, error: "Aucun fichier reçu." };
  if (valeur.size === 0) return { ok: false, error: "Fichier vide." };
  if (valeur.size > TAILLE_MAX) {
    return { ok: false, error: "L'image fait plus de 5 Mo. Compresse-la et réessaie." };
  }

  /* On lit les octets APRÈS le contrôle de taille : sans cet ordre, un fichier
     énorme serait chargé en mémoire avant d'être refusé. */
  const octets = new Uint8Array(await valeur.arrayBuffer());
  const format = formatImage(octets);
  if (!format) {
    return {
      ok: false,
      error: `Ce fichier n'est pas une image — utilise ${FORMATS_LISIBLES}. Les SVG ne sont pas acceptés : ils peuvent contenir du code.`,
    };
  }

  return { ok: true, image: { octets, format, ext: format, type: TYPE_SERVI[format] } };
}
