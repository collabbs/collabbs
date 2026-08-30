import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runAffiliatePayouts } from "@/lib/affiliate-billing";

// Tourne le 1er de chaque mois : regroupe par créateur les commissions validées
// et les vire sur son compte Stripe connecté, à partir du minimum de versement.
// Ce qui n'atteint pas le minimum reste acquis et repart au mois suivant.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const res = await runAffiliatePayouts();
  return NextResponse.json({ ok: true, ...res });
}
