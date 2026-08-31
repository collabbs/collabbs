"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { valider } from "@/lib/validation";
import { engagementSchema } from "@/lib/schemas/engagements";
import { ouvrirLeMois } from "@/lib/engagement-mois";
import { finDuPreavis, libelleEngagement, coutTotal } from "@/lib/ambassadeur";
import { notify } from "@/lib/notifications";
import { eur } from "@/lib/campaign";

type Result = { ok: boolean; error?: string; id?: string };

/**
 * La marque transforme une collaboration en partenariat récurrent.
 *
 * On part d'une collaboration existante et non d'un profil : on ne nomme pas
 * ambassadeur quelqu'un avec qui on n'a jamais travaillé. Le format, le réseau
 * et le montant en sont repris — la marque les ajuste, elle ne les ressaisit
 * pas.
 */
export async function creerEngagement(
  dealId: string,
  data: { months: number; contentsPerMonth: number; monthlyAmount: number },
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select("id, brand_id, creator_id, format, platform_id, engagement_id")
    .eq("id", dealId)
    .single();
  if (!deal || deal.brand_id !== user.id) return { ok: false, error: "Action non autorisée." };
  // Une collaboration issue d'un engagement ne peut pas en engendrer un second :
  // on empoilerait deux calendriers de paiement sur le même créateur.
  if (deal.engagement_id)
    return {
      ok: false,
      error: "Cette collaboration fait déjà partie d'un partenariat récurrent.",
    };

  const controle = valider(engagementSchema, data);
  if (!controle.ok) return { ok: false, error: controle.error };

  // Un seul engagement actif par couple : deux calendriers parallèles avec le
  // même créateur produiraient deux collaborations par mois sans que personne
  // comprenne pourquoi.
  const { data: existant } = await supabase
    .from("engagements")
    .select("id")
    .eq("brand_id", user.id)
    .eq("creator_id", deal.creator_id)
    .eq("status", "active")
    .maybeSingle();
  if (existant)
    return {
      ok: false,
      error: "Tu as déjà un partenariat récurrent en cours avec ce créateur.",
    };

  const { data: eng, error } = await supabase
    .from("engagements")
    .insert({
      brand_id: user.id,
      creator_id: deal.creator_id,
      monthly_amount: controle.data.monthlyAmount,
      contents_per_month: controle.data.contentsPerMonth,
      months_total: controle.data.months,
      format: deal.format,
      platform_id: deal.platform_id,
      source_deal_id: deal.id,
    })
    .select("id")
    .single();
  if (error || !eng) return { ok: false, error: error?.message ?? "Création impossible." };

  await notify({
    userId: deal.creator_id,
    type: "deal_proposed",
    title: "Une marque te propose un partenariat récurrent 🤝",
    body: `${libelleEngagement(controle.data.months, controle.data.contentsPerMonth, controle.data.monthlyAmount)} — soit ${eur(coutTotal(controle.data.monthlyAmount, controle.data.months))} sur la durée. La collaboration du premier mois vient d'être ouverte.`,
    link: "/deals",
  });

  // Le premier mois s'ouvre tout de suite : attendre le passage de l'automate
  // laisserait la marque devant un engagement qui n'a rien produit, et le
  // créateur sans rien à accepter.
  const premier = await ouvrirLeMois(eng.id);
  if (!premier.ok) return { ok: false, error: premier.error };

  revalidatePath("/deals");
  revalidatePath(`/deals/${dealId}`);
  return { ok: true, id: eng.id };
}

/**
 * L'une des deux parties met fin au partenariat.
 *
 * Les collaborations DÉJÀ ouvertes ne sont pas touchées : elles ont un contrat
 * signé et parfois un séquestre. Rompre empêche d'en ouvrir de nouvelles, ça
 * n'annule pas ce qui est en cours — c'est la seule règle qui permette à
 * chacun de partir sans léser l'autre.
 */
export async function rompreEngagement(engagementId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: eng } = await supabase
    .from("engagements")
    .select("id, brand_id, creator_id, status, months_total, months_created, notice_days")
    .eq("id", engagementId)
    .single();
  if (!eng || (eng.brand_id !== user.id && eng.creator_id !== user.id))
    return { ok: false, error: "Action non autorisée." };
  if (eng.status !== "active") return { ok: true, id: eng.id };

  const maintenant = new Date().toISOString();
  const { error } = await supabase
    .from("engagements")
    .update({ status: "ended", ended_at: maintenant, ended_by: user.id })
    .eq("id", engagementId);
  if (error) return { ok: false, error: error.message };

  const autre = eng.brand_id === user.id ? eng.creator_id : eng.brand_id;
  const restants = eng.months_total - eng.months_created;
  await notify({
    userId: autre,
    type: "deal_cancelled",
    title: "Le partenariat récurrent prend fin",
    body:
      restants > 0
        ? `${restants} mois ne seront pas ouverts. Les collaborations déjà en cours continuent normalement jusqu'à leur terme.`
        : "Tous les mois convenus ont été ouverts. Les collaborations en cours continuent normalement.",
    link: "/deals",
  });

  revalidatePath("/deals");
  return { ok: true, id: eng.id, ...(finDuPreavis(maintenant) ? {} : {}) };
}

/**
 * Ouverture manuelle du mois suivant, par la marque.
 *
 * L'automate le fait chaque jour, mais une marque pressée — un lancement
 * produit avancé de deux semaines — doit pouvoir prendre les devants sans
 * attendre l'échéance. Elle paie le mois, c'est sa décision.
 */
export async function ouvrirLeMoisSuivant(engagementId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const admin = createAdminClient();
  const { data: eng } = await admin
    .from("engagements")
    .select("brand_id")
    .eq("id", engagementId)
    .single();
  if (!eng || eng.brand_id !== user.id) return { ok: false, error: "Action non autorisée." };

  const res = await ouvrirLeMois(engagementId);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/deals");
  return { ok: true, id: res.dealId };
}
