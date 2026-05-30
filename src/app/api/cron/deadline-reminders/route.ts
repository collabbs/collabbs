import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";

// Tourne tous les jours : pour chaque deal `active` dont la deadline est
// dans les 3 prochains jours ET qui a au moins un livrable non encore livré,
// on envoie un rappel au créateur. La notif `notifications` insère toujours,
// donc le throttling 24h évite le spam.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const limit = new Date(now.getTime() + 3 * 24 * 3600 * 1000);

  const { data: deals } = await admin
    .from("deals")
    .select("id, creator_id, title, deadline, deliverables(id, done)")
    .eq("status", "active")
    .not("deadline", "is", null)
    .gte("deadline", now.toISOString().slice(0, 10))
    .lte("deadline", limit.toISOString().slice(0, 10));

  let sent = 0;
  for (const d of deals ?? []) {
    const hasPending = (d.deliverables ?? []).some((dv) => !dv.done);
    if (!hasPending) continue;

    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(d.deadline!).getTime() - now.getTime()) / (24 * 3600 * 1000)),
    );

    await notify({
      userId: d.creator_id,
      type: "deal_deadline_reminder",
      title:
        daysLeft <= 1
          ? `⏰ Deadline demain : "${d.title ?? "ta collaboration"}"`
          : `⏰ Plus que ${daysLeft} jours sur "${d.title ?? "ta collaboration"}"`,
      body: "Il te reste des livrables à déposer. Ouvre la page du deal pour le faire.",
      link: `/deals/${d.id}`,
      throttleMinutes: 24 * 60,
    });
    sent += 1;
  }

  return NextResponse.json({ ok: true, checked: deals?.length ?? 0, sent });
}
