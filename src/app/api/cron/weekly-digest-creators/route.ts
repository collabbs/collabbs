import { montant } from "@/lib/euros";
import { NextResponse } from "next/server";
import { repondreEtNoter } from "@/lib/journal-taches";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { countsAsEarning } from "@/lib/affiliate-earnings";

/** Digests envoyés ensemble. Séquentiellement, chacun coûtait ~150 ms. */
const TAILLE_PAQUET = 20;
/** Le temps qu'on s'autorise. Un digest non parti repart la semaine suivante. */
const BUDGET_MS = 40_000;

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

  /* Un passage par lien, pas un passage par créateur ET par événement.
     Le compte se faisait en refiltrant TOUS les événements de la semaine pour
     CHAQUE créateur : 502 créateurs × tous les événements. Ici on range une
     fois par lien, puis on additionne par créateur. */
  const parLien = new Map<string, typeof events extends (infer E)[] | null ? E[] : never>();
  for (const e of events ?? []) {
    const liste = parLien.get(e.link_id);
    if (liste) liste.push(e);
    else parLien.set(e.link_id, [e]);
  }

  const aEnvoyer: { creatorId: string; clicks: number; sales: number; gains: number }[] = [];
  for (const [creatorId, linkIds] of byCreator) {
    let clicks = 0;
    let sales = 0;
    let gains = 0;
    let vus = 0;
    for (const linkId of linkIds) {
      for (const e of parLien.get(linkId) ?? []) {
        vus += 1;
        if (e.type === "click") clicks += 1;
        else if (countsAsEarning(e)) {
          // Annoncer par courriel des gains qui ont été rejetés serait la pire
          // façon de les apprendre. Les actions (CPA) comptent, elles.
          sales += 1;
          gains += Number(e.commission_amount ?? 0);
        }
      }
    }
    if (vus === 0) continue;
    aEnvoyer.push({ creatorId, clicks, sales, gains });
  }

  /* Par paquets, et sous un budget.
     Les digests partaient un par un : mesuré aujourd'hui sur le projet de
     développement, 59 envois pour 502 créateurs en 8,8 s — soit une centaine
     de secondes à cinq mille créateurs actifs, et la plateforme couperait la
     fonction en route. On s'arrête nous-mêmes, et ce qui n'est pas parti
     repartira la semaine suivante : un digest est une nouvelle de la semaine
     passée, pas une obligation.

     Compte les digests PRODUITS, pas les e-mails délivrés : `notify` crée la
     notification dans l'app, et l'e-mail peut échouer derrière. Le nommer
     « sent » laissait croire à un envoi réussi. */
  const finDuBudget = Date.now() + BUDGET_MS;
  let digests = 0;
  let restants = 0;
  for (let i = 0; i < aEnvoyer.length; i += TAILLE_PAQUET) {
    if (Date.now() > finDuBudget) {
      restants = aEnvoyer.length - i;
      break;
    }
    const paquet = aEnvoyer.slice(i, i + TAILLE_PAQUET);
    await Promise.all(
      paquet.map(({ creatorId, clicks, sales, gains }) =>
        notify({
          userId: creatorId,
          type: "weekly_digest_creator",
          title: `Ta semaine sur Collabbs — ${clicks} clic${clicks > 1 ? "s" : ""}, ${montant(gains)} gagnés`,
          body: `Sur les 7 derniers jours : ${clicks} clic${clicks > 1 ? "s" : ""} sur tes liens, ${sales} vente${sales > 1 ? "s" : ""}, ${montant(gains)} de commissions. Continue !`,
          link: "/opportunities",
        }),
      ),
    );
    digests += paquet.length;
  }

  return repondreEtNoter("weekly-digest-creators", debutTache, {
    ok: true,
    creators: byCreator.size,
    digests,
    restants,
  });
}
