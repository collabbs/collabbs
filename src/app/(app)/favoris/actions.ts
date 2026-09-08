"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Ce qu'on a retenu pendant le défilé, rapatrié dans le compte.
 *
 * ─── Le trou que ça bouche ───
 * Les intérêts vivaient dans le navigateur, et personne d'autre ne les lisait.
 * Un créateur aimait huit campagnes, créait son compte, et ne retrouvait rien :
 * tout le tunnel menait à un geste dont le résultat était jeté.
 *
 * ─── Pourquoi une reprise, et pas une écriture directe ───
 * Le défilé s'utilise AVANT d'avoir un compte — c'est même tout son intérêt.
 * On ne peut donc rien écrire au moment du geste. La reprise se fait à la
 * première visite de l'espace, comme pour le questionnaire des marques.
 */

/** Rapatrie les campagnes aimées. Ne lève jamais : rien n'est perdu en cas d'échec. */
export async function reprendreFavoris(
  ids: string[],
): Promise<{ ok: boolean; ajoutes: number }> {
  if (ids.length === 0) return { ok: true, ajoutes: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, ajoutes: 0 };

  // On borne : la liste vient du navigateur, elle a pu être bricolée.
  const propres = [...new Set(ids)]
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 200);
  if (propres.length === 0) return { ok: true, ajoutes: 0 };

  // Les campagnes qui n'existent plus sont ignorées plutôt que de faire
  // échouer toute la reprise : une campagne close ne doit pas coûter les sept
  // autres.
  const { data: vivantes } = await supabase
    .from("campaigns")
    .select("id")
    .in("id", propres);
  const valides = (vivantes ?? []).map((c) => c.id);
  if (valides.length === 0) return { ok: true, ajoutes: 0 };

  const { error } = await supabase
    .from("campagnes_favorites")
    .upsert(
      valides.map((campaign_id) => ({ creator_id: user.id, campaign_id })),
      { onConflict: "creator_id,campaign_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, ajoutes: 0 };

  revalidatePath("/favoris");
  return { ok: true, ajoutes: valides.length };
}

/** Rapatrie les créateurs repérés par une marque. */
export async function reprendreReperages(
  ids: string[],
): Promise<{ ok: boolean; ajoutes: number }> {
  if (ids.length === 0) return { ok: true, ajoutes: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, ajoutes: 0 };

  const propres = [...new Set(ids)]
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 200);
  if (propres.length === 0) return { ok: true, ajoutes: 0 };

  const { data: vivants } = await supabase.from("creators").select("id").in("id", propres);
  const valides = (vivants ?? []).map((c) => c.id);
  if (valides.length === 0) return { ok: true, ajoutes: 0 };

  // ⚠️ On réutilise `brand_creator_saves`, qui existait déjà.
  //
  // J'allais créer une table `createurs_reperes` — c'était le symétrique
  // évident. Elle aurait fait double emploi : « la marque a retenu ce
  // créateur » était déjà stocké ici. Deux tables pour une même idée, ce sont
  // deux vérités qui divergent le jour où l'une est mise à jour et pas
  // l'autre.
  const { error } = await supabase
    .from("brand_creator_saves")
    .upsert(
      valides.map((creator_id) => ({ brand_id: user.id, creator_id })),
      { onConflict: "brand_id,creator_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, ajoutes: 0 };

  revalidatePath("/favoris");
  return { ok: true, ajoutes: valides.length };
}

/** Retirer un favori depuis la liste. */
export async function retirerFavori(campaignId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("campagnes_favorites")
    .delete()
    .eq("creator_id", user.id)
    .eq("campaign_id", campaignId);
  revalidatePath("/favoris");
}
