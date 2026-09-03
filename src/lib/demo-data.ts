import "server-only";

/**
 * Les données de démonstration doivent-elles apparaître ?
 *
 * La base contient 24 créateurs fictifs (`creators.is_demo`) et 6 marques
 * fictives (`brands.is_demo`, migration 0053) avec leurs campagnes :
 * photographies de banque d'images, tarifs inventés, avis semés à la main.
 *
 * Le 30 août ce module les masquait tous en production. Décision de Julien le
 * 3 septembre : **les créateurs fictifs reviennent**, parce qu'un catalogue
 * qui contient une seule fiche ne convertit personne et qu'il n'y a pas
 * d'alternative tant que les vrais créateurs ne sont pas arrivés. Le risque
 * assumé : une marque peut écrire à un profil fictif et n'obtenir aucune
 * réponse. Aucun euro n'est en jeu — `acceptDeal` refuse tout appelant qui
 * n'est pas le créateur, et `createDealCheckout` exige un deal déjà actif.
 *
 * Les MARQUES fictives, elles, restent masquées : les démasquer ferait
 * candidater de vrais créateurs à des campagnes de « Sephora » qui n'existent
 * pas. Le côté créateur n'a pas le même besoin — son annuaire à lui, ce sont
 * les campagnes, et il en existe de vraies.
 *
 * D'où deux interrupteurs distincts plutôt qu'un seul :
 * `demoCreatorsVisible()` pour l'annuaire des créateurs, `demoVisible()` pour
 * les marques et leurs campagnes.
 *
 * `NEXT_PUBLIC_SHOW_DEMO_DATA` force les DEUX : « 1 » les affiche, « 0 » les
 * cache — l'échappatoire reste utile pour une préproduction propre.
 */
export function demoCreatorsVisible(): boolean {
  const forcage = process.env.NEXT_PUBLIC_SHOW_DEMO_DATA;
  if (forcage === "1") return true;
  if (forcage === "0") return false;
  // Volontairement vrai en production : voir ci-dessus.
  return true;
}

/**
 * Marques et campagnes de démonstration : visibles en développement,
 * invisibles en production. Un créateur ne doit pas candidater dans le vide.
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
 * Lecture séparée plutôt qu'une colonne dans chaque requête : l'appel ne se
 * fait que lorsque les données de démonstration sont cachées — donc jamais en
 * développement.
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
