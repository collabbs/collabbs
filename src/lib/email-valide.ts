/**
 * Validation d'adresse e-mail — volontairement permissive.
 *
 * On ne cherche PAS à décider si une adresse existe : seul un envoi le dit.
 * On écarte ce qui ne peut pas être une adresse, et rien de plus. Une
 * expression régulière trop stricte rejette des adresses parfaitement
 * valables — apostrophes, signes plus, domaines longs, extensions récentes —
 * et le seul effet mesurable d'un tel refus est de perdre la personne.
 */
export function emailPlausible(brut: string): boolean {
  const v = brut.trim();
  if (v.length < 6 || v.length > 254) return false;
  // Exactement une arobase, du texte des deux côtés, un point après.
  const arobases = v.split("@");
  if (arobases.length !== 2) return false;
  const [local, domaine] = arobases;
  if (!local || local.length > 64) return false;
  if (!domaine || domaine.length > 253) return false;
  if (!domaine.includes(".")) return false;
  if (domaine.startsWith(".") || domaine.endsWith(".")) return false;
  if (domaine.includes("..")) return false;
  // Ni espace ni caractère de contrôle nulle part.
  if (/[\s<>",;]/.test(v)) return false;
  // Extension d'au moins deux lettres.
  const extension = domaine.split(".").pop() ?? "";
  if (extension.length < 2 || !/^[a-z]+$/i.test(extension)) return false;
  return true;
}

/** Forme canonique pour la déduplication : minuscules, sans espaces autour. */
export function normaliserEmail(brut: string): string {
  return brut.trim().toLowerCase();
}
