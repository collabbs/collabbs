"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creerLienAffilie } from "@/lib/lien-affilie";

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

  // Même fabrique que depuis les opportunités. Cette entrée-ci ne posait
  // AUCUN code promo, même sur une campagne qui en demande un : les ventes de
  // ces créateurs n'étaient attribuables à personne.
  const lien = await creerLienAffilie(user.id, campaignId);
  if (!lien.ok) redirect(`/c/${campaignId}?error=activation`);

  redirect(`/opportunities?activated=1${lien.existait ? "&existing=1" : ""}`);
}
