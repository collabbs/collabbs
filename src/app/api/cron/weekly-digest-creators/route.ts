import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";

// Tourne tous les lundis matin : pour chaque créateur ayant au moins un lien
// d'affiliation, calcule ses stats des 7 derniers jours (clics, ventes,
// commissions) et envoie un digest. Skippe ceux sans activité (pour ne pas
// envoyer un email qui dit "tu n'as eu aucun clic, désolé").
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  // Pour chaque créateur ayant au moins un lien, on récupère ses links + events.
  const { data: links } = await admin
    .from("affiliate_links")
    .select("id, creator_id");
  const byCreator = new Map<string, string[]>();
  for (const l of links ?? []) {
    const arr = byCreator.get(l.creator_id) ?? [];
    arr.push(l.id);
    byCreator.set(l.creator_id, arr);
  }
  const allLinkIds = (links ?? []).map((l) => l.id);
  if (allLinkIds.length === 0) {
    return NextResponse.json({ ok: true, creators: 0, sent: 0 });
  }

  const { data: events } = await admin
    .from("affiliate_events")
    .select("link_id, type, sale_amount, commission_amount, occurred_at")
    .in("link_id", allLinkIds)
    .gte("occurred_at", since);

  let sent = 0;
  for (const [creatorId, linkIds] of byCreator) {
    const linkSet = new Set(linkIds);
    const myEvents = (events ?? []).filter((e) => linkSet.has(e.link_id));
    if (myEvents.length === 0) continue;

    let clicks = 0;
    let sales = 0;
    let gains = 0;
    for (const e of myEvents) {
      if (e.type === "click") clicks += 1;
      else if (e.type === "sale") {
        sales += 1;
        gains += Number(e.commission_amount ?? 0);
      }
    }

    const eurFmt = (n: number) =>
      n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

    await notify({
      userId: creatorId,
      type: "weekly_digest_creator",
      title: `Ta semaine sur Collabbs — ${clicks} clic${clicks > 1 ? "s" : ""}, ${eurFmt(gains)} gagnés`,
      body: `Sur les 7 derniers jours : ${clicks} clic${clicks > 1 ? "s" : ""} sur tes liens, ${sales} vente${sales > 1 ? "s" : ""}, ${eurFmt(gains)} de commissions. Continue !`,
      link: "/opportunities",
    });
    sent += 1;
  }

  return NextResponse.json({ ok: true, creators: byCreator.size, sent });
}
