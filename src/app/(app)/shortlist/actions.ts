"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import {
  createursAInviter,
  resumeInvitations,
  MAX_INVITATIONS_PAR_ENVOI,
} from "@/lib/invitations";

/**
 * Toggle un créateur dans la shortlist de la marque connectée.
 * Renvoie le nouvel état (saved: true/false).
 */
export async function toggleSavedCreator(
  creatorId: string,
): Promise<{ ok: boolean; saved?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "brand")
    return { ok: false, error: "Réservé aux marques." };

  const { data: existing } = await supabase
    .from("brand_creator_saves")
    .select("creator_id")
    .eq("brand_id", user.id)
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("brand_creator_saves")
      .delete()
      .eq("brand_id", user.id)
      .eq("creator_id", creatorId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/shortlist");
    revalidatePath("/creators");
    return { ok: true, saved: false };
  }

  const { error } = await supabase
    .from("brand_creator_saves")
    .insert({ brand_id: user.id, creator_id: creatorId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shortlist");
  revalidatePath("/creators");
  return { ok: true, saved: true };
}

/**
 * Invite plusieurs créateurs sur une campagne, d'un seul geste.
 *
 * ─── Ce que cette action rend possible et qui ne l'était pas ───
 * Jusqu'ici la mise en relation ne partait que du créateur. Une marque
 * arrivant sur une place de marché encore vide n'avait littéralement aucun
 * moyen d'aller chercher quelqu'un.
 *
 * ─── Trois choix qui méritent d'être écrits ───
 * · **On n'échoue pas sur les doublons.** Cocher toute sa shortlist alors
 *   qu'on a déjà invité la moitié est le geste normal, pas une erreur : on
 *   invite le reste et on le dit.
 * · **On insère tout en une fois.** Une boucle d'insertions laisserait, en cas
 *   de coupure, une moitié d'invitations parties et l'autre non, sans que
 *   personne ne sache où ça s'est arrêté.
 * · **Les notifications viennent après l'écriture, et leur échec ne défait
 *   rien.** Une invitation enregistrée mais non notifiée reste visible sur
 *   l'écran du créateur ; une invitation annulée parce qu'un e-mail n'est pas
 *   parti serait une régression silencieuse.
 */
export async function inviterCreateurs(
  campaignId: string,
  creatorIds: string[],
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  if (creatorIds.length > MAX_INVITATIONS_PAR_ENVOI) {
    return {
      ok: false,
      error: `Pas plus de ${MAX_INVITATIONS_PAR_ENVOI} créateurs à la fois.`,
    };
  }

  // La campagne doit appartenir à la marque connectée ET être ouverte : inviter
  // quelqu'un sur une campagne en brouillon ou terminée l'enverrait vers une
  // page qui ne lui propose rien.
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, status, brand_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign || campaign.brand_id !== user.id) {
    return { ok: false, error: "Campagne introuvable." };
  }
  if (campaign.status !== "active") {
    return {
      ok: false,
      error: "Cette campagne n'est pas ouverte : publie-la avant d'inviter des créateurs.",
    };
  }

  // Qui est déjà en relation avec cette campagne — candidature reçue comme
  // invitation déjà envoyée. La contrainte d'unicité en base ne fait pas la
  // différence entre les deux, la lecture non plus.
  const { data: existantes } = await supabase
    .from("applications")
    .select("creator_id")
    .eq("campaign_id", campaignId)
    .in("creator_id", creatorIds);

  const { aInviter, ignores } = createursAInviter(
    creatorIds,
    (existantes ?? []).map((a) => a.creator_id),
  );

  if (aInviter.length === 0) {
    return { ok: true, message: resumeInvitations(0, ignores.length) };
  }

  const { data: creees, error } = await supabase
    .from("applications")
    .insert(
      aInviter.map((creatorId) => ({
        campaign_id: campaignId,
        creator_id: creatorId,
        initiated_by: "brand" as const,
        status: "pending" as const,
      })),
    )
    // `.select()` n'est pas décoratif : sans lui, un refus de la politique RLS
    // ressemble trait pour trait à une réussite, et la marque croirait avoir
    // invité des gens qui n'ont jamais rien reçu.
    .select("creator_id");

  if (error) {
    return { ok: false, error: "Les invitations n'ont pas pu être envoyées. Réessaie." };
  }
  const envoyees = creees ?? [];

  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  const nomMarque = brand?.name?.trim() || "Une marque";

  await Promise.all(
    envoyees.map((a) =>
      notify({
        userId: a.creator_id,
        type: "campaign_invitation",
        title: `${nomMarque} t'invite sur « ${campaign.name} »`,
        body: "Une marque a repéré ton profil et te propose de participer à sa campagne. À toi de voir : tu peux accepter ou décliner.",
        link: `/opportunities/${campaignId}`,
      }),
    ),
  );

  revalidatePath("/shortlist");
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true, message: resumeInvitations(envoyees.length, ignores.length) };
}
