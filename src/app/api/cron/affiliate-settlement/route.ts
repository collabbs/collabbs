import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runAffiliateValidation } from "@/lib/affiliate-billing";

// Tourne tous les jours : les ventes réservées dont le délai de rétractation est
// écoulé passent en « validées ». À partir de là la commission est définitivement
// acquise au créateur et entre dans le prochain versement.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const res = await runAffiliateValidation();
  return NextResponse.json({ ok: true, ...res });
}
