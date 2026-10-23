import { NextResponse } from "next/server";
import { repondreEtNoter } from "@/lib/journal-taches";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { countsAsEarning } from "@/lib/affiliate-earnings";

// Tourne tous les lundis matin : pour chaque créateur ayant au moins un lien
// d'affiliation, calcule ses stats des 7 derniers jours (clics, ventes,
// commissions) et envoie un digest. Skippe ceux sans activité (pour ne pas
// envoyer un email qui dit "tu n'as eu aucun clic, désolé").
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Le passage est note meme sans travail a faire : sans ca, « rien a
  // faire » et « ne tourne pas » se ressemblent trait pour trait.
  const debutTache = Date.now();

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
  if ((links ?? []).length === 0) {
    return NextResponse.json({ ok: true, creators: 0, digests: 0 });
  }

  /* Pas de `.in("link_id", …)` ici — et ce n'est pas un oubli.
     La liste contenait TOUS les liens de la plateforme, et une liste d'UUID
     passée dans l'URL d'une requête PostgREST franchit une marche vers 350
     entrees : au-dela, la meme requete coute huit secondes au lieu de cent
     millisecondes (voir `par-tranches.ts`). Ce cron y tombait des le 500e
     lien, donc aujourd'hui.
     Le filtre etait de toute facon sans effet : `affiliate_events.link_id`
     est `not null references affiliate_links(id)`, donc tout evenement
     appartient deja a un lien existant. La fenetre d'une semaine borne ce
     qu'on lit ; la liste ne bornait rien. */
  const { data: events } = await admin
    .from("affiliate_events")
    .select("link_id, type, status, sale_amount, commission_amount, occurred_at")
    .gte("occurred_at", since);

  // Compte les digests PRODUITS, pas les e-mails délivrés : `notify` crée
  // toujours la notification dans l'app, et l'e-mail peut échouer derrière.
  // Le nommer « sent » laissait croire à un envoi réussi.
  let digests = 0;
  for (const [creatorId, linkIds] of byCreator) {
    const linkSet = new Set(linkIds);
    const myEvents = (events ?? []).filter((e) => linkSet.has(e.link_id));
    if (myEvents.length === 0) continue;

    let clicks = 0;
    let sales = 0;
    let gains = 0;
    for (const e of myEvents) {
      if (e.type === "click") clicks += 1;
      else if (countsAsEarning(e)) {
        // Annoncer par courriel des gains qui ont été rejetés serait la pire
        // façon de les apprendre. Les actions (CPA) comptent, elles.
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
    digests += 1;
  }

  return repondreEtNoter("weekly-digest-creators", debutTache, { ok: true, creators: byCreator.size, digests });
}
