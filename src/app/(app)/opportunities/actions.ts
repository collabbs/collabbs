"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { fabriquerCodePromo } from "@/lib/promo-code";
import { peutDecider } from "@/lib/invitations";
import { evaluerProfil, phraseManquants } from "@/lib/profil-listable";
import { chargerListabilite } from "@/lib/profil-listable.server";

export async function activateAffiliateLink(
  campaignId: string,
): Promise<{ ok: boolean; code?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: existing } = await supabase
    .from("affiliate_links")
    .select("code")
    .eq("creator_id", user.id)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (existing) return { ok: true, code: existing.code };

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 10);

  const [{ data: camp }, { data: meProfile }, { data: moi }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("brand_id, name, with_promo_code, promo_code")
      .eq("id", campaignId)
      .single(),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("creators").select("handle").eq("id", user.id).maybeSingle(),
  ]);

  // Le code promo était le grand absent : il n'était JAMAIS posé, donc
  // `/api/track/promo` — qui résout la vente par ce code — répondait « code
  // promo introuvable » à chaque appel, et la fiche de campagne affichait
  // éternellement un faux exemple, « TON@HANDLE-XX ».
  //
  // Il est unique par créateur, sinon une vente n'est attribuable à personne.
  // Le code de la marque sert de préfixe : « MAISON » → « MAISON-JULIEN ».
  let promoCode: string | null = null;
  if (camp?.with_promo_code) {
    for (let tentative = 0; tentative < 5 && !promoCode; tentative++) {
      const candidat = fabriquerCodePromo(camp.promo_code, moi?.handle, tentative);
      const { data: pris } = await supabase
        .from("affiliate_links")
        .select("id")
        .eq("promo_code", candidat)
        .maybeSingle();
      if (!pris) promoCode = candidat;
    }
  }

  const { error } = await supabase
    .from("affiliate_links")
    .insert({ campaign_id: campaignId, creator_id: user.id, code, promo_code: promoCode });
  if (error) return { ok: false, error: error.message };
  if (camp?.brand_id) {
    await notify({
      userId: camp.brand_id,
      type: "affiliate_joined",
      title: `${meProfile?.display_name ?? "Un créateur"} vient de rejoindre "${camp.name}"`,
      body: "Tu as un nouvel affilié actif. Suis ses performances depuis la page de ta campagne.",
      link: `/campaigns/${campaignId}`,
    });
  }

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${campaignId}`);
  return { ok: true, code };
}

export async function applyToCampaign(
  campaignId: string,
  message?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // Un profil incomplet n'apparaît PAS au catalogue (`getMarketplaceCreators`)
  // — mais rien n'empêchait jusqu'ici son titulaire de candidater. La marque
  // recevait donc une candidature sans photo, sans audience et sans tarif,
  // d'une personne qu'elle ne peut même pas retrouver dans l'annuaire. On
  // refuse, en disant ce qui manque : c'est le meilleur moment pour demander
  // au créateur de compléter son profil, puisqu'il veut quelque chose.
  const etat = evaluerProfil(await chargerListabilite(supabase, user.id));
  if (!etat.listable) {
    return {
      ok: false,
      error: `${phraseManquants(etat.manquants)} Les marques ne peuvent pas te trouver tant que ton profil est incomplet.`,
    };
  }

  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("creator_id", user.id)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (existing) return { ok: true };

  const { error } = await supabase.from("applications").insert({
    campaign_id: campaignId,
    creator_id: user.id,
    initiated_by: "creator",
    status: "pending",
    message: message?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${campaignId}`);
  return { ok: true };
}

/**
 * Le créateur répond à l'invitation d'une marque.
 *
 * Le pendant exact de `decideApplication` côté marque, et il fallait bien
 * qu'il existe : une ligne d'`applications` créée par la marque ne peut pas
 * se trancher par la marque elle-même, sinon inviter reviendrait à s'engager
 * tout seul à deux.
 *
 * `peutDecider` porte cette règle pour les deux actions — plutôt que de la
 * réécrire ici en miroir, où elle finirait par diverger.
 */
export async function repondreInvitation(
  campaignId: string,
  reponse: "accepted" | "rejected",
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: invitation } = await supabase
    .from("applications")
    .select("id, status, initiated_by, campaigns(name, brand_id)")
    .eq("campaign_id", campaignId)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (!invitation) return { ok: false, error: "Invitation introuvable." };
  if (!peutDecider("creator", invitation.initiated_by, invitation.status)) {
    // Couvre trois cas d'un coup : c'est une candidature (donc à la marque de
    // trancher), elle est déjà tranchée, ou les deux.
    return { ok: false, error: "Cette invitation n'est plus en attente." };
  }

  // `.eq("status", "pending")` ferme la porte au double clic : la deuxième
  // exécution ne touche aucune ligne et ne renotifie personne.
  const { data: majs, error } = await supabase
    .from("applications")
    .update({ status: reponse })
    .eq("id", invitation.id)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, error: "La réponse n'a pas pu être enregistrée." };
  if (!majs || majs.length === 0) return { ok: true };

  const brandId = invitation.campaigns?.brand_id;
  const nomCampagne = invitation.campaigns?.name ?? "ta campagne";
  const { data: moi } = await supabase
    .from("creators")
    .select("handle")
    .eq("id", user.id)
    .maybeSingle();
  const pseudo = moi?.handle ? `@${moi.handle}` : "Un créateur";

  if (brandId) {
    await notify({
      userId: brandId,
      type: reponse === "accepted" ? "invitation_accepted" : "invitation_declined",
      title:
        reponse === "accepted"
          ? `${pseudo} accepte ton invitation sur « ${nomCampagne} »`
          : `${pseudo} décline ton invitation sur « ${nomCampagne} »`,
      body:
        reponse === "accepted"
          ? "Tu peux maintenant lui proposer une collaboration depuis la campagne."
          : "Ce créateur n'est pas disponible pour cette campagne. Tu peux en inviter d'autres depuis ta shortlist.",
      link: `/campaigns/${campaignId}`,
    });
  }

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true };
}
