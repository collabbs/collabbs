import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { reportError } from "@/lib/report-error";
import { eur } from "@/lib/campaign";

/**
 * Ouvre la collaboration d'un mois d'engagement.
 *
 * C'est le seul endroit qui matérialise un engagement en argent, et il ne fait
 * qu'une chose : créer une collaboration ORDINAIRE. Séquestre, contrat,
 * livraison, versement — tout ce qui suit emprunte les chemins existants.
 *
 * ─── Le doublon est le risque numéro un ───
 * L'automate tourne tous les jours. Si une exécution crée la collaboration
 * puis échoue avant d'incrémenter le compteur, la suivante en ouvrirait une
 * seconde pour le même mois — avec son contrat, et bientôt son séquestre.
 * Deux remparts, dans cet ordre :
 *
 *  1. Un index unique sur `(engagement_id, engagement_month)` en base. C'est
 *     lui qui décide, parce que lui seul est atomique.
 *  2. La violation de cet index (23505) n'est PAS traitée comme une erreur :
 *     elle signifie « ce mois existe déjà ». On répare alors le compteur et on
 *     s'en va. C'est le cas exact de l'exécution interrompue.
 */

export type OuvertureMois = {
  ok: boolean;
  dealId?: string;
  /** Le mois existait déjà : rien n'a été créé, le compteur a été réparé. */
  deja?: boolean;
  error?: string;
};

/** Référence de contrat lisible, style CLB-XXXXXX. */
function referenceContrat(): string {
  return "CLB-" + crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

export async function ouvrirLeMois(engagementId: string): Promise<OuvertureMois> {
  const admin = createAdminClient();

  const { data: eng } = await admin
    .from("engagements")
    .select(
      "id, brand_id, creator_id, monthly_amount, contents_per_month, months_total, months_created, format, platform_id, status",
    )
    .eq("id", engagementId)
    .single();
  if (!eng) return { ok: false, error: "Engagement introuvable." };
  if (eng.status !== "active") return { ok: false, error: "Cet engagement est terminé." };
  if (eng.months_created >= eng.months_total)
    return { ok: false, error: "Tous les mois de cet engagement ont été ouverts." };

  const mois = eng.months_created + 1;

  const { data: nom } = await admin
    .from("brands")
    .select("name")
    .eq("id", eng.brand_id)
    .maybeSingle();

  const { data: deal, error } = await admin
    .from("deals")
    .insert({
      brand_id: eng.brand_id,
      creator_id: eng.creator_id,
      engagement_id: eng.id,
      engagement_month: mois,
      // Le titre porte le rang du mois : dans une liste de collaborations, un
      // ambassadeur en aurait douze au même nom sans moyen de les distinguer.
      title: `Ambassadeur ${nom?.name ?? "marque"} — mois ${mois}/${eng.months_total}`,
      amount: eng.monthly_amount,
      quantity: eng.contents_per_month,
      format: eng.format,
      platform_id: eng.platform_id,
      status: "negotiation",
    })
    .select("id")
    .single();

  if (error) {
    // 23505 sur l'index unique : ce mois a déjà été ouvert par une exécution
    // précédente qui n'a pas pu incrémenter le compteur. On répare et on sort.
    if (error.code === "23505") {
      await admin
        .from("engagements")
        .update({ months_created: mois })
        .eq("id", eng.id)
        .lt("months_created", mois);
      return { ok: true, deja: true };
    }
    return { ok: false, error: error.message };
  }

  // Livrables : autant que de contenus convenus par mois. Sans eux, le créateur
  // n'a nulle part où déposer son travail.
  const lignes = Array.from({ length: eng.contents_per_month }, (_, i) => ({
    deal_id: deal.id,
    label:
      eng.contents_per_month > 1
        ? `Contenu ${i + 1} / ${eng.contents_per_month}`
        : "Contenu livré",
    position: i + 1,
  }));
  const { error: errLivrables } = await admin.from("deliverables").insert(lignes);

  // Contrat : une collaboration sans contrat n'a aucune valeur juridique. On
  // réessaie sur collision de référence, comme ailleurs.
  let contratOk = false;
  for (let essai = 0; essai < 5 && !contratOk; essai++) {
    const { error: errContrat } = await admin
      .from("contracts")
      .insert({ deal_id: deal.id, reference: referenceContrat(), status: "draft" });
    if (!errContrat) contratOk = true;
    else if (errContrat.code === "23505" && errContrat.message.includes("deal_id")) contratOk = true;
    else if (errContrat.code !== "23505") break;
  }

  if (errLivrables || !contratOk) {
    // On ne supprime PAS la collaboration : elle porte déjà le mois dans un
    // index unique, et la détruire rouvrirait la porte au doublon. On la laisse
    // et on alerte — une collaboration incomplète se répare, un doublon de
    // séquestre beaucoup moins.
    await reportError("engagement/ouverture-mois", errLivrables ?? new Error("contrat"), {
      detail: `Mois ${mois} de l'engagement ${eng.id} ouvert (deal ${deal.id}) mais ${errLivrables ? "les livrables" : "le contrat"} n'ont pas pu être créés.`,
    });
  }

  const { error: errCompteur } = await admin
    .from("engagements")
    .update({ months_created: mois })
    .eq("id", eng.id);
  if (errCompteur) {
    // Sans incrément, l'automate repassera demain — et se heurtera à l'index
    // unique, qui réparera le compteur. Le défaut est donc auto-résolutif ;
    // on le signale quand même, parce qu'il ne devrait jamais arriver.
    await reportError("engagement/compteur", errCompteur, {
      detail: `Mois ${mois} de l'engagement ${eng.id} ouvert mais le compteur n'a pas pu être incrémenté.`,
    });
  }

  await notify({
    userId: eng.creator_id,
    type: "deal_proposed",
    title: `Mois ${mois}/${eng.months_total} de ton partenariat — ${eur(eng.monthly_amount)}`,
    body: "La collaboration du mois vient d'être ouverte. Ouvre-la pour accepter les termes.",
    link: `/deals/${deal.id}`,
  });
  await notify({
    userId: eng.brand_id,
    type: "deal_proposed",
    title: `Mois ${mois}/${eng.months_total} ouvert avec ton ambassadeur`,
    body: `${eur(eng.monthly_amount)} à régler une fois le créateur d'accord.`,
    link: `/deals/${deal.id}`,
  });

  return { ok: true, dealId: deal.id };
}
