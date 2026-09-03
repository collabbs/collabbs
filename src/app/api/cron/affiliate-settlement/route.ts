import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runAffiliateValidation } from "@/lib/affiliate-billing";
import { purgeRateLimitBuckets } from "@/lib/rate-limit";
import { expirerAbonnementsEchus } from "@/lib/abonnement-stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { eur } from "@/lib/deal";

/**
 * Relance des ventes que la marque n'a jamais tranchées.
 *
 * Une vente déclarée par le pixel attend toujours la confirmation de la marque
 * — c'est volontaire : le navigateur déclare une vente, il ne la prouve pas.
 * La marque reçoit une notification à chaque vente, et c'est tout. Si elle ne
 * la lit pas, la commission du créateur attend INDÉFINIMENT : rien ne relance,
 * rien n'expire, et le créateur n'a même pas été prévenu que sa vente existait.
 *
 * On ne peut pas valider automatiquement — ce serait ouvrir la porte à des
 * ventes fabriquées. Mais on peut refuser que le silence soit sans conséquence :
 * la marque est relancée chaque semaine, et le créateur apprend que son argent
 * attend chez elle plutôt que de ne rien voir venir.
 */
async function relancerVentesARevoir(): Promise<{ relances: number }> {
  const admin = createAdminClient();
  const ilYASeptJours = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data: enAttente } = await admin
    .from("affiliate_events")
    .select(
      "id, commission_amount, sale_amount, created_at, affiliate_links(creator_id, campaigns(brand_id))",
    )
    .eq("needs_review", true)
    .lte("created_at", ilYASeptJours);

  let relances = 0;
  for (const ev of enAttente ?? []) {
    const lien = ev.affiliate_links;
    const brandId = lien?.campaigns?.brand_id;
    const creatorId = lien?.creator_id;
    const commission = Number(ev.commission_amount ?? 0);
    const jours = Math.floor((Date.now() - new Date(ev.created_at).getTime()) / 86_400_000);

    if (brandId) {
      await notify({
        userId: brandId,
        type: "pixel_sale_review_overdue",
        title: `Une vente attend ta confirmation depuis ${jours} jours`,
        body:
          `Une vente de ${eur(Number(ev.sale_amount ?? 0))} déclarée depuis ta boutique n'a toujours pas été ` +
          `tranchée. Tant qu'elle ne l'est pas, ${eur(commission)} de commission restent dus à un créateur ` +
          `qui attend. Confirme-la ou rejette-la.`,
        link: "/billing",
        throttleMinutes: 7 * 24 * 60,
      });
    }
    if (creatorId) {
      await notify({
        userId: creatorId,
        type: "affiliate_sale_awaiting_brand",
        title: `${eur(commission)} en attente chez la marque`,
        body:
          "Une vente que tu as générée attend d'être confirmée par la marque. Nous la relançons. " +
          "Rien n'est perdu : la commission te reviendra dès qu'elle aura tranché.",
        link: "/payouts",
        throttleMinutes: 7 * 24 * 60,
      });
    }
    relances += 1;
  }
  return { relances };
}

// Tourne tous les jours : les ventes réservées dont le délai de rétractation est
// écoulé passent en « validées ». À partir de là la commission est définitivement
// acquise au créateur et entre dans le prochain versement.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const res = await runAffiliateValidation();

  // Ménage des seaux de limitation de débit. Greffé ici plutôt que dans une
  // entrée `vercel.json` supplémentaire : c'est du nettoyage, il tourne une
  // fois par jour, et son échec ne doit rien empêcher — `purgeRateLimitBuckets`
  // signale et renvoie 0.
  const purgedRateLimits = await purgeRateLimitBuckets();

  // Filet des abonnements : Stripe prévient normalement à la résiliation, mais
  // un webhook manqué laisserait une marque au tarif préférentiel pour
  // toujours. Cette passe quotidienne rattrape ce que l'évènement n'a pas fait.
  const plansExpires = await expirerAbonnementsEchus();

  // Relance des ventes que la marque laisse en suspens : sans elle, la
  // commission d'un créateur peut attendre indéfiniment sur une seule
  // notification non lue.
  const { relances } = await relancerVentesARevoir();
  return NextResponse.json({ ok: true, ...res, purgedRateLimits, plansExpires, relances });
}
