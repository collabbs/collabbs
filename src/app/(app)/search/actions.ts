"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchHit = {
  type: "creator" | "brand" | "campaign";
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string | null;
  href: string;
};

/**
 * Recherche globale serveur.
 * Cherche dans :
 * - creators : par handle, par profile.display_name
 * - brands : par name
 * - campaigns : par name (uniquement actives)
 *
 * Limité aux résultats publics + ceux accessibles via RLS au viewer.
 */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  /* Converti une fois, ici : une action serveur est une adresse HTTP publique
     et le type annoncé dans la signature n'est qu'une promesse du client. Un
     corps de requête portant autre chose qu'une chaîne faisait planter l'action
     sur « .trim is not a function » — une erreur non rattrapée, au lieu du
     contrôle écrit juste après. */
  const q = String(query ?? "").trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const like = `%${q}%`;

  const [creatorsRes, brandsRes, campaignsRes] = await Promise.all([
    // Créateurs : on rejoint sur profiles pour le display_name et l'avatar.
    supabase
      .from("creators")
      .select("id, handle, profiles!inner(display_name, avatar_url)")
      /* `.ilike("handle", like)` et NON `.or(`handle.ilike.${like}`)`.

         `.or()` attend une chaîne écrite dans la grammaire de filtres de
         PostgREST, et la saisie de l'utilisateur y était concaténée telle
         quelle. Une recherche contenant une virgule ou un point n'était donc
         plus une valeur : elle devenait de la structure, et pouvait modifier
         la condition appliquée à la table.

         La politique de lecture sur `creators` est `using (true)` : toutes les
         lignes sont visibles de tout inscrit, et un filtre porte sur TOUTES
         les colonnes, y compris celles qu'on ne sélectionne pas ici
         (`total_earnings`, `stripe_account_id`). Une condition choisie par
         l'appelant n'a donc rien à faire dans cette requête.

         `.ilike()` passe la valeur en PARAMÈTRE : elle ne peut plus être lue
         comme de la structure. C'est déjà ce que font les deux requêtes
         suivantes, sur `brands` et `campaigns`. Et cette clause n'avait de
         toute façon qu'une seule condition — le `.or()` était inutile. */
      .ilike("handle", like)
      .limit(5),
    supabase
      .from("brands")
      .select("id, name, sector, logo_url")
      .ilike("name", like)
      .limit(5),
    supabase
      .from("campaigns")
      .select("id, name, type, brands(name)")
      .ilike("name", like)
      .eq("status", "active")
      .eq("privee", false)
      .limit(5),
  ]);

  const hits: SearchHit[] = [];

  for (const c of creatorsRes.data ?? []) {
    const p = c.profiles;
    if (!c.handle) continue;
    hits.push({
      type: "creator",
      id: c.id,
      title: p?.display_name ?? c.handle,
      subtitle: `@${c.handle}`,
      avatar: p?.avatar_url ?? null,
      href: `/creators/${c.handle}`,
    });
  }
  for (const b of brandsRes.data ?? []) {
    hits.push({
      type: "brand",
      id: b.id,
      title: b.name,
      subtitle: b.sector ?? undefined,
      avatar: b.logo_url ?? null,
      href: `/brands/${b.id}`,
    });
  }
  for (const c of campaignsRes.data ?? []) {
    hits.push({
      type: "campaign",
      id: c.id,
      title: c.name,
      subtitle: c.brands?.name ?? c.type,
      href: `/opportunities/${c.id}`,
    });
  }

  return hits;
}

/**
 * Pour les créateurs : aussi chercher par display_name (qui est dans profiles
 * et pas directement filtrable depuis creators). On le fait en 2e passe pour
 * compléter les résultats si on n'a pas assez de match handle.
 */
export async function searchCreatorsByName(query: string): Promise<SearchHit[]> {
  const q = String(query ?? "").trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const like = `%${q}%`;

  // Search dans profiles role=creator par display_name
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, creators!inner(handle)")
    .ilike("display_name", like)
    .eq("role", "creator")
    .limit(5);

  const result: SearchHit[] = [];
  for (const p of data ?? []) {
    const handle = p.creators?.handle;
    if (!handle) continue;
    result.push({
      type: "creator",
      id: p.id,
      title: p.display_name ?? handle,
      subtitle: `@${handle}`,
      avatar: p.avatar_url ?? null,
      href: `/creators/${handle}`,
    });
  }
  return result;
}
