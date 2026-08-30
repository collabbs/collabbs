import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { partySnapshotFor } from "@/lib/contract-snapshot";
import { thresholdFor, LEGAL_THRESHOLD } from "@/lib/legal-threshold";
import { AFFILIATE_FEE_RATE, VALIDATION_DAYS, MIN_PAYOUT } from "@/lib/affiliate-billing";
import { notify } from "@/lib/notifications";
import type { AffiliateContractSnapshot } from "@/lib/contract-template";

/* eslint-disable @typescript-eslint/no-explicit-any */
const untyped = (c: unknown) => c as any;

/**
 * Contrat-cadre d'affiliation.
 *
 * Trou comblé ici : un créateur qui ne faisait QUE de l'affiliation ou du CPA
 * avec une marque n'avait jamais de contrat. Activer un lien est un clic — cela
 * crée un lien de suivi, rien d'autre : pas de collaboration, donc pas de
 * contrat. Or ces commissions comptent dans le seuil de 1 000 € par an et par
 * couple, et ce seuil n'était consulté qu'à l'intérieur du parcours de
 * collaboration. Sans collaboration, jamais consulté.
 *
 * Un créateur pouvait donc toucher 3 000 € d'une même marque sans qu'aucun
 * contrat écrit n'existe et sans que personne ne soit averti — exactement la
 * situation que vise le décret n° 2025-1137.
 *
 * On établit donc un contrat-cadre par couple et par année civile, dès que le
 * seuil est franchi. Il est créé en **brouillon** et notifié aux deux parties :
 * la plateforme ne signe pas à leur place, et n'a pas à le faire — elle n'est
 * pas partie au contrat.
 */

/** Référence lisible, distincte de celle des contrats de collaboration. */
function frameworkRef(): string {
  return "CLB-A" + crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase();
}

export type EnsureResult =
  | { created: false; reason: "already_exists" | "below_threshold" | "no_affiliate_income" }
  | { created: true; contractId: string; reference: string; missing: string[] };

/**
 * Établit le contrat-cadre du couple si le seuil légal est franchi.
 *
 * Appelée après chaque commission réglée. Le test d'existence passe en premier :
 * une fois le contrat créé, le calcul coûteux du cumul ne tourne plus jamais
 * pour ce couple et cette année.
 */
export async function ensureAffiliateFrameworkContract(
  brandId: string,
  creatorId: string,
  year: number = new Date().getFullYear(),
): Promise<EnsureResult> {
  const admin = createAdminClient();

  const { data: existant } = await untyped(admin)
    .from("contracts")
    .select("id")
    .eq("kind", "affiliate")
    .eq("brand_id", brandId)
    .eq("creator_id", creatorId)
    .eq("period_year", year)
    .maybeSingle();
  if (existant) return { created: false, reason: "already_exists" };

  const seuil = await thresholdFor(brandId, creatorId, year);
  if (!seuil.required) return { created: false, reason: "below_threshold" };
  // Les collaborations ont déjà chacune leur contrat. Le contrat-cadre ne se
  // justifie que s'il y a effectivement de l'affiliation à couvrir.
  if (seuil.fromAffiliate <= 0) return { created: false, reason: "no_affiliate_income" };

  const [marque, createur] = await Promise.all([
    partySnapshotFor(brandId, "brand"),
    partySnapshotFor(creatorId, "creator"),
  ]);

  const snapshot: AffiliateContractSnapshot = {
    version: 1,
    kind: "affiliate",
    generated_at: new Date().toISOString(),
    period_year: year,
    brand: marque.party,
    creator: createur.party,
    earned_to_date: seuil.fromAffiliate,
    platform_fee_pct: Math.round(AFFILIATE_FEE_RATE * 100),
    validation_days: VALIDATION_DAYS,
    min_payout: MIN_PAYOUT,
  };

  // Les informations légales peuvent manquer : on ne bloque rien, contrairement
  // à l'acceptation d'une collaboration. L'argent est déjà gagné, le retenir
  // punirait le créateur pour une case vide — chez lui ou chez la marque. On
  // établit le contrat et on dit à chacun ce qu'il lui reste à compléter.
  const missing = [
    ...marque.missing.map((f) => `marque:${f}`),
    ...createur.missing.map((f) => `créateur:${f}`),
  ];

  let contrat: { id: string; reference: string } | null = null;
  for (let essai = 0; essai < 5; essai++) {
    const reference = frameworkRef();
    const { data, error } = await untyped(admin)
      .from("contracts")
      .insert({
        kind: "affiliate",
        deal_id: null,
        brand_id: brandId,
        creator_id: creatorId,
        period_year: year,
        reference,
        status: "pending_signature",
        terms_snapshot: snapshot,
      })
      .select("id, reference")
      .single();
    if (!error && data) {
      contrat = data;
      break;
    }
    // Course entre deux commissions simultanées : l'index unique tranche, et le
    // contrat existe — c'est le résultat recherché.
    if (error?.code === "23505" && !error.message.includes("reference")) {
      return { created: false, reason: "already_exists" };
    }
    if (error?.code !== "23505") {
      console.error("[affiliate-contract] création impossible", error);
      return { created: false, reason: "below_threshold" };
    }
  }
  if (!contrat) {
    console.error("[affiliate-contract] aucune référence disponible");
    return { created: false, reason: "below_threshold" };
  }

  const seuilFr = LEGAL_THRESHOLD.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });

  await Promise.all([
    notify({
      userId: brandId,
      type: "affiliate_contract_required",
      title: "Un contrat écrit est désormais obligatoire",
      body: `Les rémunérations versées à ${createur.party.display_name} cette année dépassent ${seuilFr}. La loi impose un contrat écrit : il est prêt, il ne reste qu'à le signer.`,
      link: "/contracts",
    }),
    notify({
      userId: creatorId,
      type: "affiliate_contract_required",
      title: "Un contrat écrit est désormais obligatoire",
      body: `Ce que tu as gagné avec ${marque.party.display_name} cette année dépasse ${seuilFr}. La loi impose un contrat écrit : il est prêt, il ne reste qu'à le signer.`,
      link: "/contracts",
    }),
  ]).catch(() => {});

  return {
    created: true,
    contractId: contrat.id,
    reference: contrat.reference,
    missing,
  };
}
