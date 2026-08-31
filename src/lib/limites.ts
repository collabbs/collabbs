import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { planDeLaMarque } from "@/lib/abonnement";
import { TARIFS, limiteCampagnesActives, planValide } from "@/lib/tarifs";

/**
 * Ce que le plan d'une marque l'autorise à faire.
 *
 * Une seule règle décide de ce qu'on limite : **on limite la vitrine, jamais
 * la caisse.** Ouvrir une campagne de plus est un geste de croissance, on peut
 * demander à le payer. Encaisser une collaboration, verser un créateur,
 * honorer un contrat signé : jamais — bloquer ça bloquerait le chiffre
 * d'affaires de la marque, et le nôtre avec.
 *
 * Le comptage se fait ici, côté serveur, à partir de la base : une limite qui
 * ne vivrait que dans l'écran se contournerait en rechargeant la page.
 */

export type EtatCapacite = {
  plan: ReturnType<typeof planValide>;
  libellePlan: string;
  /** Campagnes actuellement actives. */
  actives: number;
  /** Plafond du plan. `null` = sans limite. */
  limite: number | null;
  /** Reste-t-il de la place pour en ouvrir une ? */
  disponible: boolean;
};

export async function capaciteCampagnes(brandId: string): Promise<EtatCapacite> {
  const plan = await planDeLaMarque(brandId);
  const limite = limiteCampagnesActives(plan);

  const admin = createAdminClient();
  const { count } = await admin
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("status", "active");

  const actives = count ?? 0;
  return {
    plan: planValide(plan),
    libellePlan: TARIFS[planValide(plan)].libelle,
    actives,
    limite,
    disponible: limite === null || actives < limite,
  };
}

/**
 * Le message affiché quand la marque bute sur son plafond.
 *
 * Il dit trois choses, et c'est le minimum pour ne pas être vécu comme une
 * punition : combien elle en a, ce que son plan autorise, et les DEUX façons
 * d'avancer — mettre une campagne en pause, ou passer au plan supérieur. Sans
 * la première, on ne laisserait qu'une porte payante à quelqu'un qui a peut-
 * être simplement oublié de clore une campagne finie.
 */
export function messageCapaciteAtteinte(etat: EtatCapacite): string {
  const combien = etat.limite === 1 ? "une seule campagne active" : `${etat.limite} campagnes actives`;
  return (
    `Ton plan ${etat.libellePlan} autorise ${combien}, et tu en as déjà ${etat.actives}. ` +
    `Mets une campagne en pause pour libérer la place, ou passe au plan supérieur pour en ouvrir plusieurs en même temps. ` +
    `Tes collaborations en cours ne sont pas concernées : elles continuent normalement.`
  );
}
