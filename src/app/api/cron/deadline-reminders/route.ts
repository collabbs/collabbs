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

  // ---------------------------------------------------------------
  // Échéances DÉPASSÉES
  // ---------------------------------------------------------------
  //
  // La requête ci-dessus ne regarde que les trois jours à VENIR. Passée la
  // date, la collaboration sortait de la requête et plus personne n'était
  // prévenu : le créateur recevait des rappels jusqu'à l'échéance puis plus
  // rien — ce qui se lit comme « c'est bon » —, et la marque, dont l'argent
  // dort en séquestre, n'apprenait jamais que la date était passée.
  //
  // On prévient donc les deux, une fois par semaine. Hebdomadaire et non
  // quotidien : au-delà de l'échéance il n'y a plus de compte à rebours utile,
  // seulement un fait à rappeler, et le rappeler chaque jour ferait couper les
  // notifications par les deux parties.
  const hier = new Date(now.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: retards } = await admin
    .from("deals")
    .select("id, creator_id, brand_id, title, deadline, deliverables(id, done)")
    .eq("status", "active")
    .not("deadline", "is", null)
    .lte("deadline", hier);

  let overdue = 0;
  for (const d of retards ?? []) {
    if (!(d.deliverables ?? []).some((dv) => !dv.done)) continue;

    const joursDeRetard = Math.floor(
      (now.getTime() - new Date(d.deadline!).getTime()) / (24 * 3600 * 1000),
    );
    const titre = d.title ?? "la collaboration";
    const jours = `${joursDeRetard} jour${joursDeRetard > 1 ? "s" : ""}`;

    await notify({
      userId: d.creator_id,
      type: "deal_deadline_overdue",
      title: `Échéance dépassée de ${jours} : « ${titre} »`,
      body:
        "Des livrables n'ont pas encore été déposés. Si tu as besoin de plus de temps, " +
        "dis-le à la marque : un retard annoncé se règle, un silence se paie en confiance.",
      link: `/deals/${d.id}`,
      throttleMinutes: 7 * 24 * 60,
    });

    await notify({
      userId: d.brand_id,
      type: "deal_deadline_overdue",
      title: `« ${titre} » a dépassé son échéance de ${jours}`,
      body:
        "Le créateur n'a pas encore livré. Nous l'avons relancé. Rien n'ayant été livré, " +
        "tu peux récupérer les fonds séquestrés depuis la page de la collaboration.",
      link: `/deals/${d.id}`,
      throttleMinutes: 7 * 24 * 60,
    });
    overdue += 1;
  }

  return NextResponse.json({ ok: true, checked: deals?.length ?? 0, sent, overdue });
}
