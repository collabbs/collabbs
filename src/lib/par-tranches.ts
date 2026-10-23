import "server-only";

/**
 * Interroger par tranches quand la liste d'identifiants peut grandir.
 *
 * ─── La falaise ───
 * PostgREST passe un `.in("id", [...])` dans l'URL de la requête. Avec des
 * UUID, chaque identifiant pèse 37 caractères : 300 tiennent dans 11 ko, 400
 * en font 15. Mesuré le 23/10/2026 sur le projet de développement, sur une
 * table de 1 000 lignes :
 *
 *     10 identifiants  →    87 ms
 *    300 identifiants  →   111 ms
 *    400 identifiants  → 7 835 ms
 *    502 identifiants  → 8 132 ms
 *
 * Ce n'est pas une pente, c'est une marche : quelque part entre 11 et 15 ko
 * d'URL, la requête cesse d'être servie normalement et coûte soixante-dix fois
 * plus cher. Le plan Postgres n'y est pour rien — la même requête sur 300
 * identifiants d'une table identique répond en un dixième de seconde.
 *
 * Conséquence mesurée avant correction, avec 500 créateurs en base :
 * l'annuaire mettait 16,8 s, le défilé côté marque 15,6 s, la shortlist 16,2 s.
 * Avec deux comptes de test, ces mêmes pages répondaient instantanément — le
 * défaut n'existe qu'à l'échelle où le produit devient intéressant.
 *
 * ─── Pourquoi 200 ───
 * La marche est entre 300 et 400. On se tient à bonne distance en dessous :
 * doubler le nombre de requêtes coûte quelques dizaines de millisecondes,
 * franchir la marche en coûte huit mille.
 */
const TAILLE_TRANCHE = 200;

/**
 * Exécute `requete` sur des tranches de `ids` et concatène les résultats.
 * Les tranches partent ensemble : elles ne dépendent pas les unes des autres.
 *
 * @param ids     la liste complète, éventuellement vide
 * @param requete ce qu'on demande pour une tranche
 */
export async function parTranches<T>(
  ids: readonly string[],
  requete: (tranche: string[]) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  if (ids.length <= TAILLE_TRANCHE) return (await requete([...ids])).data ?? [];

  const tranches: string[][] = [];
  for (let i = 0; i < ids.length; i += TAILLE_TRANCHE) {
    tranches.push([...ids.slice(i, i + TAILLE_TRANCHE)]);
  }
  const resultats = await Promise.all(tranches.map((t) => requete(t)));
  return resultats.flatMap((r) => r.data ?? []);
}

/**
 * Même découpage, pour un `select("*", { count: "exact", head: true })`.
 *
 * Ces requêtes ne rapportent pas de lignes, seulement un nombre — on somme
 * les nombres au lieu de concaténer les listes. Le bandeau latéral en fait
 * deux à CHAQUE page de l'application : si l'une tombe dans la falaise, c'est
 * huit secondes ajoutées à tout l'espace connecté, pas à un seul écran.
 */
export async function compterParTranches(
  ids: readonly string[],
  requete: (tranche: string[]) => PromiseLike<{ count: number | null }>,
): Promise<number> {
  if (ids.length === 0) return 0;
  if (ids.length <= TAILLE_TRANCHE) return (await requete([...ids])).count ?? 0;

  const tranches: string[][] = [];
  for (let i = 0; i < ids.length; i += TAILLE_TRANCHE) {
    tranches.push([...ids.slice(i, i + TAILLE_TRANCHE)]);
  }
  const resultats = await Promise.all(tranches.map((t) => requete(t)));
  return resultats.reduce((somme, r) => somme + (r.count ?? 0), 0);
}

/**
 * Même découpage, mais l'erreur remonte.
 *
 * `parTranches` renvoie `data ?? []` : une requête en échec devient une liste
 * vide, indistinguable d'un « il n'y a rien ». C'est tenable là où un repli
 * existe, et inacceptable sur un chemin d'argent — une écriture ratée en
 * silence est précisément ce qui fait qu'un créateur voit ses ventes encore
 * dues après avoir été payé.
 *
 * Renvoie la PREMIÈRE erreur rencontrée, avec les lignes des tranches qui ont
 * abouti : l'appelant a besoin des deux pour savoir ce qu'il a pris et ce
 * qu'il doit rendre.
 */
export async function parTranchesSuivi<T>(
  ids: readonly string[],
  requete: (tranche: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  if (ids.length === 0) return { data: [], error: null };

  const tranches: string[][] = [];
  for (let i = 0; i < Math.max(ids.length, 1); i += TAILLE_TRANCHE) {
    tranches.push([...ids.slice(i, i + TAILLE_TRANCHE)]);
  }
  const resultats = await Promise.all(tranches.map((t) => requete(t)));
  return {
    data: resultats.flatMap((r) => r.data ?? []),
    error: resultats.find((r) => r.error)?.error ?? null,
  };
}
