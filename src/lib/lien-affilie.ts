import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fabriquerCodePromo } from "@/lib/promo-code";
import { notify } from "@/lib/notifications";

/**
 * La création d'un lien d'affiliation — le SEUL endroit où elle se fait.
 *
 * ─── Pourquoi elle a quitté le navigateur ───
 * La policy d'insertion sur `affiliate_links` ne vérifiait qu'une chose :
 * `creator_id = auth.uid()`. « C'est bien ma ligne » — mais le reste de la
 * ligne, personne ne le regardait. Depuis la console du navigateur, un
 * créateur pouvait donc s'insérer un lien portant :
 *
 *   • le CODE PROMO GÉNÉRIQUE de la marque (« SOLDES10 ») — et comme
 *     `/api/track/promo` résout la vente par ce code, toutes les ventes faites
 *     avec le code public de la marque lui étaient attribuées, y compris
 *     celles qu'il n'avait jamais amenées ;
 *   • n'importe quel `campaign_id`, y compris une campagne à laquelle il
 *     n'avait pas été accepté ;
 *   • son propre `code` de suivi, choisi.
 *
 * Le code promo est fabriqué ici, à partir du préfixe de la marque et du
 * pseudo du créateur, et vérifié unique. Il n'est jamais fourni de l'extérieur.
 *
 * ─── Et l'avis à la marque aussi ───
 * Il vivait dans la page des opportunités. L'entrée publique — celle du lien
 * qu'une marque diffuse pour recruter — ne prévenait donc personne : un
 * créateur devenait affilié et la marque ne l'apprenait jamais. Mesuré le
 * 22/10/2026 sur un créateur neuf arrivé par /c/<campagne>.
 *
 * L'avis part maintenant d'ici, avec la création. C'est la même raison que
 * pour le code promo : ce qui doit accompagner la naissance d'un lien n'a pas
 * à être réécrit par chaque appelant.
 *
 * ─── Pourquoi les deux entrées passent par ici ───
 * Il y avait deux créations de lien : la page des opportunités et la page
 * publique d'une campagne. La seconde ne posait AUCUN code promo, même sur une
 * campagne qui en demande un — les ventes de ces créateurs n'étaient
 * attribuables à personne. Deux implémentations d'une même chose finissent
 * toujours par diverger ; il n'y en a plus qu'une.
 */

export type ResultatLien =
  | { ok: true; code: string; existait: boolean }
  | { ok: false; error: string };

export async function creerLienAffilie(
  creatorId: string,
  campaignId: string,
): Promise<ResultatLien> {
  const admin = createAdminClient();

  const { data: existant } = await admin
    .from("affiliate_links")
    .select("code")
    .eq("creator_id", creatorId)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (existant) return { ok: true, code: existant.code, existait: true };

  const { data: camp } = await admin
    .from("campaigns")
    .select("id, status, with_promo_code, promo_code, brand_id, name")
    .eq("id", campaignId)
    .maybeSingle();
  if (!camp) return { ok: false, error: "Cette campagne n'existe plus." };
  if (camp.status !== "active") return { ok: false, error: "Cette campagne n'est plus ouverte." };

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 10);

  // Unique par créateur, sinon une vente n'est attribuable à personne. Le code
  // de la marque sert de préfixe : « MAISON » → « MAISON-JULIEN-K7 ».
  let promoCode: string | null = null;
  if (camp.with_promo_code) {
    const { data: moi } = await admin
      .from("creators")
      .select("handle")
      .eq("id", creatorId)
      .maybeSingle();
    for (let tentative = 0; tentative < 5 && !promoCode; tentative++) {
      const candidat = fabriquerCodePromo(camp.promo_code, moi?.handle, tentative);
      const { data: pris } = await admin
        .from("affiliate_links")
        .select("id")
        .eq("promo_code", candidat)
        .maybeSingle();
      if (!pris) promoCode = candidat;
    }
    if (!promoCode) {
      // Cinq collisions d'affilée : mieux vaut refuser que poser un lien sans
      // code sur une campagne qui en exige un — ses ventes seraient perdues.
      return { ok: false, error: "Ton code promo n'a pas pu être attribué. Réessaie." };
    }
  }

  const { error } = await admin
    .from("affiliate_links")
    .insert({ campaign_id: campaignId, creator_id: creatorId, code, promo_code: promoCode });
  if (error) return { ok: false, error: error.message };

  /* Le lien existe : la marque a un affilié de plus et doit l'apprendre.
     On est après l'insertion et dans la branche `existait === false`, donc
     l'avis ne part qu'une fois — un créateur qui recharge sa page ne renvoie
     pas la même notification en boucle. */
  if (camp.brand_id) {
    const { data: moi } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", creatorId)
      .maybeSingle();
    await notify({
      userId: camp.brand_id,
      type: "affiliate_joined",
      title: `${moi?.display_name ?? "Un créateur"} vient de rejoindre "${camp.name}"`,
      body: "Tu as un nouvel affilié actif. Suis ses performances depuis la page de ta campagne.",
      link: `/campaigns/${campaignId}`,
    });
  }

  return { ok: true, code, existait: false };
}
