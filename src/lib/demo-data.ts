import "server-only";

/**
 * Les données de démonstration doivent-elles apparaître ?
 *
 * La base contient 24 créateurs fictifs (`creators.is_demo`) et 6 marques
 * fictives (`brands.is_demo`, migration 0053) avec leurs campagnes :
 * photographies de banque d'images, tarifs inventés, avis semés à la main.
 * Ils rendent l'outil présentable pendant qu'on le construit — et ils
 * deviennent un mensonge le jour où un vrai visiteur arrive, parce que rien ne
 * les distingue du réel. Une marque peut écrire à un créateur fictif ; un
 * créateur peut candidater à une campagne de « Sephora » et attendre une
 * réponse qui ne viendra jamais.
 *
 * Règle : **visibles en développement, invisibles en production.** Le travail
 * quotidien garde son annuaire peuplé, le site public ne montre que des
 * personnes réelles — sans qu'on ait à supprimer quoi que ce soit, ni à
 * penser à le faire le jour J.
 *
 * `NEXT_PUBLIC_SHOW_DEMO_DATA` force l'un ou l'autre : « 1 » les affiche
 * (utile sur une préproduction de démonstration), « 0 » les cache.
 */
export function demoVisible(): boolean {
  const forcage = process.env.NEXT_PUBLIC_SHOW_DEMO_DATA;
  if (forcage === "1") return true;
  if (forcage === "0") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Cette marque est-elle une marque de démonstration ?
 *
 * Lecture séparée plutôt qu'une colonne dans chaque requête : `brands.is_demo`
 * arrive avec la migration 0053 et les types engendrés depuis la base ne la
 * connaissent pas encore. L'appel ne se fait que lorsque les données de démo
 * sont cachées — donc jamais en développement.
 */
export async function marqueDeDemo(
  client: unknown,
  brandId: string | null | undefined,
): Promise<boolean> {
  if (!brandId) return false;
  const { data } = await (
    client as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: { is_demo?: boolean } | null }>;
          };
        };
      };
    }
  )
    .from("brands")
    .select("is_demo")
    .eq("id", brandId)
    .maybeSingle();
  return Boolean(data?.is_demo);
}
