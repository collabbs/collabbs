import { createClient } from "@/lib/supabase/server";
import { reperesTarifaires, type Reperes } from "@/lib/benchmark";
import type { Database } from "@/lib/database.types";

type TypeOffre = Database["public"]["Enums"]["offer_type"];

/**
 * Les repères tarifaires pour un type de prestation, lus en base.
 *
 * ─── Pourquoi les tarifs affichés par les créateurs, et pas les montants
 * réellement payés ───
 * Les deux seraient intéressants, mais ils ne répondent pas à la même
 * question. Une marque qui remplit « montant par créateur » cherche à savoir
 * **ce qu'on va lui demander**, pas ce que d'autres ont fini par négocier.
 * Les tarifs affichés répondent à la première ; ils ont aussi l'avantage
 * d'exister avant la première collaboration, quand les montants payés, eux,
 * n'existent pas encore.
 *
 * ─── Ce qui est délibérément absent ───
 * Aucun filtre par audience ou par niche. Segmenter une population qui
 * atteint tout juste huit observations produirait des sous-groupes de deux
 * personnes — c'est-à-dire exactement le chiffre inventé qu'on cherche à
 * éviter. Le jour où le volume le permettra, la segmentation se fera ici, et
 * le seuil s'appliquera à chaque segment.
 */
export async function reperesPourOffre(offre: TypeOffre): Promise<Reperes> {
  const supabase = await createClient();

  // La politique RLS de `creator_offers` est publique en lecture : ces tarifs
  // sont déjà affichés sur les profils. On ne divulgue donc rien de plus que
  // ce qu'un visiteur voit en parcourant la marketplace — on l'agrège.
  const { data } = await supabase
    .from("creator_offers")
    .select("price")
    .eq("offer", offre)
    .not("price", "is", null);

  return reperesTarifaires((data ?? []).map((o) => Number(o.price)));
}

/**
 * Les repères pour TOUS les types de prestation, en une seule requête.
 *
 * Le créateur remplit trois tarifs d'affilée : appeler `reperesPourOffre`
 * trois fois ferait trois allers-retours pour des données qui tiennent dans
 * un seul. Le regroupement se fait ici, en mémoire, sur quelques centaines de
 * lignes au plus.
 *
 * Chaque type est présent dans le résultat même quand il n'a aucun tarif :
 * l'appelant récupère alors des repères de marché, ce qui est exactement ce
 * qu'il doit afficher — plutôt qu'un trou dans l'interface.
 */
export async function reperesParOffre(): Promise<Record<TypeOffre, Reperes>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creator_offers")
    .select("offer, price")
    .not("price", "is", null);

  const parType = new Map<TypeOffre, number[]>();
  for (const o of data ?? []) {
    const liste = parType.get(o.offer) ?? [];
    liste.push(Number(o.price));
    parType.set(o.offer, liste);
  }

  const types: TypeOffre[] = ["ugc", "post", "perf", "affil", "story"];
  return Object.fromEntries(
    types.map((t) => [t, reperesTarifaires(parType.get(t) ?? [])]),
  ) as Record<TypeOffre, Reperes>;
}
