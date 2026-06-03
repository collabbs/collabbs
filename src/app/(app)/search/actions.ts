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
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const like = `%${q}%`;

  const [creatorsRes, brandsRes, campaignsRes] = await Promise.all([
    // Créateurs : on rejoint sur profiles pour le display_name et l'avatar.
    supabase
      .from("creators")
      .select("id, handle, profiles!inner(display_name, avatar_url)")
      .or(`handle.ilike.${like}`)
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
  const q = query.trim();
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
