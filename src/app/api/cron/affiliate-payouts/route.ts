import { NextResponse } from "next/server";
import { repondreEtNoter } from "@/lib/journal-taches";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runAffiliatePayouts } from "@/lib/affiliate-billing";

// Tourne le 1er de chaque mois : regroupe par créateur les commissions validées
// et les vire sur son compte Stripe connecté, à partir du minimum de versement.
// Ce qui n'atteint pas le minimum reste acquis et repart au mois suivant.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Le passage est note meme sans travail a faire : sans ca, « rien a
  // faire » et « ne tourne pas » se ressemblent trait pour trait.
  const debutTache = Date.now();

  const res = await runAffiliatePayouts();
  return repondreEtNoter("affiliate-payouts", debutTache, { ok: true, ...res });
}
