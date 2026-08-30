import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runAffiliateValidation } from "@/lib/affiliate-billing";
import { purgeRateLimitBuckets } from "@/lib/rate-limit";

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

  return NextResponse.json({ ok: true, ...res, purgedRateLimits });
}
