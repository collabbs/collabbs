import { NextResponse } from "next/server";
import { repondreEtNoter } from "@/lib/journal-taches";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runAffiliatePayouts } from "@/lib/affiliate-billing";

// Tourne CHAQUE JOUR : regroupe par créateur les commissions validées et les
// vire sur son compte Stripe connecté, à partir du minimum de versement. Ce qui
// n'atteint pas le minimum reste acquis et repart le lendemain.
//
// ─── Pourquoi quotidien et non mensuel ───
// Deux raisons, et la seconde compte plus que la première.
//
// Un passage peut s'arrêter avant d'avoir tout traité — c'est voulu, il vaut
// mieux s'arrêter net que se faire couper au milieu d'un virement. En mensuel,
// ce qui restait attendait le mois suivant : un créateur payé avec trente jours
// de retard, sans que rien ne l'explique. En quotidien, le reste part demain.
//
// Et surtout : le seuil de 20 € fait déjà le regroupement. Attendre le 1er
// n'ajoutait aucune protection, seulement du délai — jusqu'à trente jours entre
// le moment où un créateur a gagné sa commission et celui où il la touche. Sur
// une plateforme dont le problème est de garder ses créateurs, c'est le
// mauvais endroit où être lent.
//
// Le contrat signé, lui, n'a jamais promis de date : « versée dès lors que le
// total acquis atteint 20 € ». On s'y conforme mieux qu'avant.
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
