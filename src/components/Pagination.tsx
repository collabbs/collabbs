import Link from "next/link";

/**
 * Pagination de liste.
 *
 * ─── Pourquoi elle existe ───
 * L'annuaire et les opportunités rendaient TOUTES leurs lignes. Mesuré le
 * 23/10/2026 avec 500 créateurs et 1 245 campagnes en base :
 *
 *     /creators        4,9 Mo de HTML
 *     /opportunities   2,8 Mo de HTML
 *
 * ─── CE QUE CES MÉGAOCTETS COÛTENT VRAIMENT (corrigé) ───
 * J'ai d'abord écrit que 4,9 Mo faisaient « une quinzaine de secondes d'écran
 * blanc en 4G ». C'était faux d'un ordre de grandeur : le HTML part compressé,
 * et ce balisage-là, répété cinq cents fois, se comprime quinze fois. Mesuré
 * le 23/10/2026, annuaire complet contre annuaire paginé :
 *
 *     500 fiches   5 311 040 o bruts →   360 448 o compressés  (~1,0 s à 3 Mbit/s)
 *      24 fiches     321 228 o bruts →    34 395 o compressés  (~0,1 s)
 *
 * Les quinze secondes étaient du TEMPS SERVEUR, et rien d'autre — c'est le
 * correctif `par-tranches.ts` qui les a enlevées, pas celui-ci.
 *
 * La pagination reste justifiée, pour trois raisons qui ne sont pas le
 * transfert : dix fois moins de données sur un forfait mobile ; un téléphone
 * de milieu de gamme doit analyser puis hydrater ces 5,3 Mo de balisage, ce
 * qui se paie en secondes de processeur ; et surtout, le poids grandissait
 * à CHAQUE inscription, sur la première page qu'un créateur ouvre.
 *
 * Ce n'est pas un défaut d'aujourd'hui : il grandit tout seul. Chaque
 * créateur qui s'inscrit ajoute une dizaine de kilo-octets à la page que
 * voient tous les autres.
 *
 * ─── Ce qu'on ne fait pas ───
 * Pas de défilement infini : il casse le bouton « retour » du navigateur, il
 * empêche d'envoyer un lien vers un résultat précis, et les moteurs ne le
 * suivent pas. Un numéro de page dans l'URL se partage, se met en favori, se
 * remonte dans l'historique, et se lit par un robot d'indexation.
 */

/** Pages affichées autour de la page courante, de chaque côté. */
const VOISINS = 1;

/**
 * Construit la suite de numéros à afficher, avec des trous là où on saute.
 * Toujours la première et la dernière : ce sont les deux sauts qu'on fait le
 * plus souvent (revenir au début, aller voir la fin).
 */
function numeros(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

  const vus = new Set<number>([1, pages, page]);
  for (let d = 1; d <= VOISINS; d++) {
    if (page - d >= 1) vus.add(page - d);
    if (page + d <= pages) vus.add(page + d);
  }
  const tries = [...vus].sort((a, b) => a - b);

  const sortie: (number | "…")[] = [];
  let precedent = 0;
  for (const n of tries) {
    if (precedent && n - precedent > 1) sortie.push("…");
    sortie.push(n);
    precedent = n;
  }
  return sortie;
}

export default function Pagination({
  page,
  pages,
  href,
  libelle = "Pagination",
}: {
  /** Page courante, à partir de 1. */
  page: number;
  /** Nombre total de pages. */
  pages: number;
  /** Lien vers une page donnée, filtres courants conservés. */
  href: (page: number) => string;
  /** Nom du groupe pour les lecteurs d'écran. */
  libelle?: string;
}) {
  if (pages <= 1) return null;

  const commun =
    "inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition";

  return (
    <nav aria-label={libelle} className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={`${commun} text-zinc-600 hover:bg-zinc-100 hover:text-ink`}>
          <span aria-hidden>‹</span>
          <span className="ml-1.5 hidden sm:inline">Précédent</span>
          <span className="sr-only sm:hidden">Page précédente</span>
        </Link>
      ) : (
        /* Désactivé plutôt qu'absent : les boutons ne se déplacent pas d'une
           page à l'autre, donc on ne clique pas « Suivant » par accident en
           croyant viser le même endroit qu'au clic précédent. */
        <span aria-hidden className={`${commun} cursor-default text-zinc-300`}>
          <span>‹</span>
          <span className="ml-1.5 hidden sm:inline">Précédent</span>
        </span>
      )}

      {numeros(page, pages).map((n, i) =>
        n === "…" ? (
          <span key={`saut-${i}`} aria-hidden className="px-1 text-sm text-zinc-400">
            …
          </span>
        ) : n === page ? (
          <span
            key={n}
            aria-current="page"
            className={`${commun} bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm`}
          >
            {n}
          </span>
        ) : (
          <Link
            key={n}
            href={href(n)}
            className={`${commun} text-zinc-600 hover:bg-zinc-100 hover:text-ink`}
          >
            {n}
          </Link>
        ),
      )}

      {page < pages ? (
        <Link href={href(page + 1)} rel="next" className={`${commun} text-zinc-600 hover:bg-zinc-100 hover:text-ink`}>
          <span className="mr-1.5 hidden sm:inline">Suivant</span>
          <span className="sr-only sm:hidden">Page suivante</span>
          <span aria-hidden>›</span>
        </Link>
      ) : (
        <span aria-hidden className={`${commun} cursor-default text-zinc-300`}>
          <span className="mr-1.5 hidden sm:inline">Suivant</span>
          <span>›</span>
        </span>
      )}
    </nav>
  );
}

/**
 * Découpe une liste et dit tout ce qu'il faut savoir pour l'afficher.
 *
 * Borne la page demandée : `?page=0`, `?page=-3`, `?page=abc` et
 * `?page=999999` sur trois résultats ramènent tous à la page 1 plutôt qu'à
 * une liste vide. Une URL tapée à la main, un lien vieilli ou un robot qui
 * essaie des numéros ne doivent pas tomber sur un écran « aucun résultat »
 * alors qu'il y en a.
 */
export function decouper<T>(
  tout: readonly T[],
  pageDemandee: string | undefined,
  parPage: number,
): { page: number; pages: number; lignes: T[]; premier: number; dernier: number } {
  const pages = Math.max(1, Math.ceil(tout.length / parPage));
  // Strictement des chiffres. `parseInt` lirait « 2 » dans `?page=2.7.1` et
  // dans `?page=2zz` : trois URLs servant la même page, que les moteurs
  // comptent comme du contenu dupliqué. Ce que le site n'a jamais produit, il
  // ne le sert pas — il ramène à la page 1.
  const brut = /^\d+$/.test(pageDemandee ?? "") ? Number(pageDemandee) : 1;
  const page = Math.min(Math.max(brut, 1), pages);
  const debut = (page - 1) * parPage;
  const lignes = tout.slice(debut, debut + parPage);
  return {
    page,
    pages,
    lignes,
    premier: tout.length === 0 ? 0 : debut + 1,
    dernier: debut + lignes.length,
  };
}
