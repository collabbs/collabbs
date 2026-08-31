import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { planValide, type Plan } from "@/lib/tarifs";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Le plan d'une marque, tel qu'il doit être appliqué MAINTENANT.
 *
 * Deux garde-fous, et ils vont dans le même sens — on ne facture jamais moins
 * que le tarif dû :
 *
 *  · un plan inconnu vaut « gratuit » (colonne absente, valeur héritée,
 *    marque créée avant les abonnements) ;
 *  · un plan dont l'échéance est passée vaut « gratuit », même si la base dit
 *    encore autre chose. Le webhook Stripe peut manquer, le cron peut avoir du
 *    retard : la lecture ne doit pas dépendre d'eux pour être juste.
 */
export async function planDeLaMarque(brandId: string | null | undefined): Promise<Plan> {
  if (!brandId) return "free";
  const admin: any = createAdminClient();
  const { data } = await admin
    .from("brands")
    .select("plan, plan_expires_at")
    .eq("id", brandId)
    .maybeSingle();
  if (!data) return "free";
  const echu =
    data.plan_expires_at != null && new Date(data.plan_expires_at).getTime() < Date.now();
  return echu ? "free" : planValide(data.plan);
}

/**
 * Le plan de la marque propriétaire d'une collaboration.
 * Passe par le deal : c'est elle qui paie la commission, pas le créateur.
 */
export async function planPourDeal(dealId: string): Promise<Plan> {
  const admin: any = createAdminClient();
  const { data } = await admin
    .from("deals")
    .select("brand_id")
    .eq("id", dealId)
    .maybeSingle();
  return planDeLaMarque(data?.brand_id);
}
