import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfilACompleter } from "./profil-listable";

/**
 * Rassemble les cinq éléments dont dépend la visibilité d'un créateur.
 *
 * Les comptes se font en `head: true` : on ne rapatrie aucune ligne, seulement
 * le nombre. Un créateur peut avoir des dizaines d'offres, on n'a besoin que
 * de savoir s'il en a au moins une.
 */
export async function chargerListabilite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  creatorId: string,
): Promise<ProfilACompleter> {
  const [profil, createur, reseaux, niches, offres] = await Promise.all([
    supabase.from("profiles").select("avatar_url").eq("id", creatorId).maybeSingle(),
    supabase.from("creators").select("handle").eq("id", creatorId).maybeSingle(),
    supabase
      .from("creator_platforms")
      .select("creator_id", { count: "exact", head: true })
      .eq("creator_id", creatorId),
    supabase
      .from("creator_niches")
      .select("creator_id", { count: "exact", head: true })
      .eq("creator_id", creatorId),
    supabase
      .from("creator_offers")
      .select("creator_id", { count: "exact", head: true })
      .eq("creator_id", creatorId),
  ]);

  return {
    pseudo: createur.data?.handle ?? null,
    photo: profil.data?.avatar_url ?? null,
    reseaux: reseaux.count ?? 0,
    niches: niches.count ?? 0,
    offres: offres.count ?? 0,
  };
}
