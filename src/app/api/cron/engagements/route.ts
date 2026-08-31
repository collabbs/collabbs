import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { doitOuvrirLeMois } from "@/lib/ambassadeur";
import { ouvrirLeMois } from "@/lib/engagement-mois";

/**
 * Ouvre chaque jour les mois d'engagement arrivés à échéance.
 *
 * L'automate ne décide de rien : il constate. `doitOuvrirLeMois` répond à la
 * question à partir du compteur de mois déjà ouverts — pas de la date du jour.
 * Une journée sans exécution se rattrape donc toute seule au lieu de faire
 * sauter un mois au créateur.
 *
 * Il n'ouvre qu'UN mois par engagement et par passage. Si l'automate est resté
 * silencieux trois mois, on ne veut pas ouvrir trois collaborations d'un coup à
 * une marque qui découvrirait trois séquestres à régler le même matin : elles
 * s'ouvriront un jour après l'autre, ce qui laisse le temps de réagir — et de
 * rompre si c'est ce qu'elle veut.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const maintenant = new Date().toISOString();

  const { data: engagements } = await admin
    .from("engagements")
    .select("id, status, months_total, months_created, starts_at")
    .eq("status", "active");

  let ouverts = 0;
  let deja = 0;
  const erreurs: string[] = [];

  for (const e of engagements ?? []) {
    if (!doitOuvrirLeMois(e, maintenant)) continue;
    const res = await ouvrirLeMois(e.id);
    if (res.ok && res.deja) deja++;
    else if (res.ok) ouverts++;
    else erreurs.push(`${e.id}: ${res.error}`);
  }

  return NextResponse.json({
    ok: true,
    examines: engagements?.length ?? 0,
    ouverts,
    deja,
    erreurs,
  });
}
