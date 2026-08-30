/**
 * Normalisation des villes.
 *
 * Une ville saisie librement arrive sous toutes les formes : « Paris »,
 * « paris », « PARIS 11 », « Saint-Étienne », « st etienne ». Sans
 * normalisation, chaque variante devient une ville distincte et le filtre ne
 * regroupe rien.
 *
 * Le slug sert au regroupement et au filtrage ; la saisie d'origine reste
 * affichée telle quelle, parce qu'un créateur doit se reconnaître.
 */

/** Abréviations courantes rencontrées dans les saisies libres. */
const EXPANSIONS: [RegExp, string][] = [
  [/^st[- ]/i, "saint-"],
  [/^ste[- ]/i, "sainte-"],
];

export function citySlug(input: string): string | null {
  let v = input.trim().toLowerCase();
  if (!v) return null;

  for (const [pattern, replacement] of EXPANSIONS) {
    v = v.replace(pattern, replacement);
  }

  v = v
    // Accents : « Saint-Étienne » et « saint-etienne » doivent se rejoindre.
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Arrondissements et codes postaux collés : « Paris 11e », « Lyon 3ème »,
    // « Marseille 13008 » désignent tous la même ville pour une recherche.
    .replace(/\s*\d+\s*(er|ere|ère|e|eme|ème)?\s*$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return v || null;
}

/** Remet une forme lisible pour l'affichage d'un slug (pages de regroupement). */
export function cityLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join("-");
}
