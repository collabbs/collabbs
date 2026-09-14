import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ilYA } from "@/lib/temps";

/**
 * Ce qu'une marque a réellement versé en collaborations sur 30 jours.
 *
 * Écrit ici, et pas recopié dans chaque écran, parce que ce nombre sert
 * maintenant à deux endroits qui doivent dire la MÊME chose : l'écran des
 * plans (« tu aurais économisé X € ») et l'écran d'arrêt (« ton plan te coûte
 * X € de plus qu'il ne t'en fait gagner »). Deux calculs légèrement différents
 * donneraient deux conseils contradictoires sur la même page.
 */
export async function volumeCollaborations30j(brandId: string): Promise<number> {
  const { data } = await createAdminClient()
    .from("transactions")
    .select("net_amount")
    .eq("brand_id", brandId)
    .eq("type", "deal_payment")
    .gte("created_at", ilYA(30));

  return Math.round(
    (data ?? []).reduce(
      (somme: number, t: { net_amount: number | string | null }) =>
        somme + Number(t.net_amount ?? 0),
      0,
    ),
  );
}
