"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Bouton "Devenir affilié" depuis la page publique d'une campagne.
 * - Anonyme → /signup en pré-remplissant le rôle créateur + on revient ici.
 * - Marque connectée → message d'erreur (cette page est pour les créateurs).
 * - Créateur connecté → active son lien (ou le réutilise) et le redirige vers
 *   son dashboard avec un message de confirmation.
 */
export async function joinAffiliationFromPublic(campaignId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = `/c/${campaignId}`;
    redirect(`/signup?role=creator&next=${encodeURIComponent(next)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "creator") redirect(`/c/${campaignId}?wrong_role=1`);

  // Vérifie que la campagne existe encore et accepte l'affiliation
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, type, status")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign || (campaign.type !== "affiliation" && campaign.type !== "hybrid"))
    redirect(`/c/${campaignId}?bad_campaign=1`);
  if (campaign.status !== "active") redirect(`/c/${campaignId}?inactive=1`);

  // Lien déjà actif ?
  const { data: existing } = await supabase
    .from("affiliate_links")
    .select("id")
    .eq("creator_id", user.id)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (existing) redirect(`/opportunities?activated=1&existing=1`);

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const { error } = await supabase
    .from("affiliate_links")
    .insert({ campaign_id: campaignId, creator_id: user.id, code });
  if (error) redirect(`/c/${campaignId}?error=activation`);

  redirect(`/opportunities?activated=1`);
}
