import "server-only";
import { createAdminClient } from "./supabase/admin";
import { notify } from "./notifications";

/**
 * Le match : quand les deux côtés se sont choisis, sans le savoir.
 *
 * ─── Pourquoi il ne pouvait pas exister ───
 * Il a été câblé deux fois, et deux fois en vain.
 *
 * D'abord au moment du geste : impossible, on fait défiler AVANT d'avoir un
 * compte, rien n'atteint la base.
 *
 * Puis à l'inscription, en croisant ce qu'on vient de retenir avec ce que
 * l'autre côté avait retenu de nous. Julien a démonté celui-là : un créateur
 * qui vient d'arriver n'a pas pu être repéré par les marques qu'il aime — il
 * n'existait pas encore quand elles ont fait défiler.
 *
 * ─── Où il vit réellement ───
 * Le match n'est pas un mécanisme d'ACQUISITION, c'est un mécanisme de RETOUR.
 * Il se forme quand le SECOND des deux agit, forcément plus tard. Le vérifier
 * à ce moment-là est la seule façon de le voir naître.
 *
 * On prévient donc les deux côtés à l'instant où la réciprocité se complète.
 * C'est ce qui fait revenir : personne ne revient pour une liste, on revient
 * parce que quelqu'un a répondu.
 */

/**
 * Vérifie si une marque et un créateur se sont choisis, et prévient si oui.
 *
 * Ne lève jamais : un match manqué est regrettable, une action qui échoue
 * parce qu'on n'a pas pu envoyer une notification l'est davantage.
 */
export async function verifierMatch(brandId: string, creatorId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();

    // La marque a-t-elle retenu ce créateur ?
    const { data: repere } = await admin
      .from("brand_creator_saves")
      .select("creator_id")
      .eq("brand_id", brandId)
      .eq("creator_id", creatorId)
      .maybeSingle();
    if (!repere) return false;

    // Le créateur a-t-il retenu une campagne de cette marque ?
    const { data: campagnes } = await admin
      .from("campaigns")
      .select("id, name")
      .eq("brand_id", brandId);
    const ids = (campagnes ?? []).map((c) => c.id);
    if (ids.length === 0) return false;

    const { data: favori } = await admin
      .from("campagnes_favorites")
      .select("campaign_id")
      .eq("creator_id", creatorId)
      .in("campaign_id", ids)
      .maybeSingle();
    if (!favori) return false;

    // Les deux se sont choisis. On le dit — aux deux.
    const [{ data: marque }, { data: createur }] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", brandId).maybeSingle(),
      admin.from("profiles").select("display_name").eq("id", creatorId).maybeSingle(),
    ]);
    const campagne = (campagnes ?? []).find((c) => c.id === favori.campaign_id);

    await Promise.all([
      notify({
        userId: creatorId,
        type: "match",
        title: `${marque?.display_name ?? "Une marque"} t'a repéré`,
        body: campagne
          ? `Tu avais retenu « ${campagne.name} ». Vous vous êtes choisis.`
          : "Vous vous êtes choisis.",
        link: "/favoris",
      }),
      notify({
        userId: brandId,
        type: "match",
        title: `${createur?.display_name ?? "Un créateur"} s'intéresse à ta campagne`,
        body: campagne
          ? `Il a retenu « ${campagne.name} », et tu l'avais repéré.`
          : "Vous vous êtes choisis.",
        link: "/shortlist",
      }),
    ]);
    return true;
  } catch {
    // Voir l'en-tête : on ne fait pas échouer un enregistrement pour ça.
    return false;
  }
}
