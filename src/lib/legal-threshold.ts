import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Suivi du seuil légal de l'influence commerciale (France).
 *
 * Décret n° 2025-1137 du 28 novembre 2025, pris pour l'application de l'article 8
 * de la loi n° 2023-451 du 9 juin 2023 : depuis le 1er janvier 2026, toute
 * collaboration entre un annonceur et un créateur doit faire l'objet d'un
 * CONTRAT ÉCRIT dès que la rémunération cumulée — somme d'argent ET valeur des
 * avantages en nature — atteint 1 000 € HT sur une même année civile.
 *
 * Le seuil s'apprécie par COUPLE marque × créateur et par ANNÉE CIVILE, pas par
 * collaboration. Deux deals à 600 € dans la même année déclenchent l'obligation,
 * même si aucun ne l'atteint seul. C'est précisément ce que personne ne suit à
 * la main — et ce que Collabbs peut calculer tout seul.
 *
 * ⚠️ Ce module compte ce que la plateforme connaît : deals, commissions
 * d'affiliation, et avantages en nature DÉCLARÉS. Un cadeau envoyé sans être
 * déclaré entre dans le calcul légal mais nous échappe — le chiffre affiché est
 * donc un plancher, jamais un quitus.
 */

/**
 * Seuil légal, en euros hors taxes, par couple marque × créateur et par année civile.
 * Défini dans `legal-threshold-const` pour rester lisible côté navigateur, et
 * réexporté ici pour que les appelants serveur n'aient pas à savoir où il vit.
 */
export { LEGAL_THRESHOLD } from "@/lib/legal-threshold-const";
import { LEGAL_THRESHOLD } from "@/lib/legal-threshold-const";

/** À partir de quelle part du seuil on prévient qu'on s'en approche. */
const WARN_RATIO = 0.7;

export type ThresholdState = {
  /** Année civile évaluée. */
  year: number;
  /** Rémunération issue des collaborations (deals engagés ou terminés). */
  fromDeals: number;
  /** Commissions d'affiliation acquises au créateur. */
  fromAffiliate: number;
  /** Valeur des avantages en nature déclarés (cadeaux, dotations, services). */
  fromInKind: number;
  /** Total connu de la plateforme. */
  total: number;
  /** Ce qu'il reste avant de déclencher l'obligation (0 si déjà atteinte). */
  remaining: number;
  /** Le contrat écrit est-il légalement obligatoire ? */
  required: boolean;
  /** On s'en approche (≥ 70 %) sans l'avoir encore atteint. */
  approaching: boolean;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const untyped = (c: unknown) => c as any;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcule où en est un couple marque × créateur sur l'année civile en cours.
 *
 * On additionne :
 *  - les deals engagés ou terminés (`amount` = ce que perçoit le créateur) ;
 *  - les commissions d'affiliation et d'action qui lui sont DUES, qu'elles
 *    soient déjà versées, acquises, réservées, ou en attente de provision.
 *
 * Les deals annulés et les commissions remboursées ou écartées ne comptent pas :
 * aucune rémunération n'a été due. Tout le reste compte, car la loi vise la
 * rémunération de l'année, pas la trésorerie.
 */
export async function thresholdFor(
  brandId: string,
  creatorId: string,
  year: number = new Date().getFullYear(),
): Promise<ThresholdState> {
  const admin = createAdminClient();
  const from = `${year}-01-01T00:00:00Z`;
  const to = `${year + 1}-01-01T00:00:00Z`;

  const { data: deals } = await admin
    .from("deals")
    .select("amount, status, created_at")
    .eq("brand_id", brandId)
    .eq("creator_id", creatorId)
    .in("status", ["active", "completed"])
    .gte("created_at", from)
    .lt("created_at", to);

  const fromDeals = (deals ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0);

  // Commissions d'affiliation : il faut passer par les liens du créateur sur
  // les campagnes de cette marque. Les ventes ET les actions (CPA) comptent —
  // la loi vise la rémunération versée entre ces deux parties, quelle que
  // soit la manière dont elle est calculée. Ne compter que les ventes
  // laisserait un créateur payé 1 200 € à l'action passer sous le seuil sans
  // contrat écrit.
  const { data: links } = await admin
    .from("affiliate_links")
    .select("id, campaigns!inner(brand_id)")
    .eq("creator_id", creatorId)
    .eq("campaigns.brand_id", brandId);
  const linkIds = (links ?? []).map((l) => l.id);

  let fromAffiliate = 0;
  if (linkIds.length > 0) {
    const { data: events } = await untyped(admin)
      .from("affiliate_events")
      .select("commission_amount, status, occurred_at")
      .in("type", ["sale", "action"])
      .in("link_id", linkIds)
      // Ce que la loi regarde, c'est la rémunération DUE sur l'année, pas
      // seulement celle déjà encaissée. Une commission réservée ou en attente
      // de provision est due au créateur : la compter plus tard retarderait
      // d'un mois le contrat écrit, alors que le seuil est déjà franchi.
      // Seules les commissions annulées ne comptent pas — rien n'est dû.
      .not("status", "in", "(refunded,rejected)")
      .gte("occurred_at", from)
      .lt("occurred_at", to);
    fromAffiliate = (events ?? []).reduce(
      (s: number, e: any) => s + Number(e.commission_amount ?? 0),
      0,
    );
  }

  // Avantages en nature : la loi les compte au même titre que l'argent.
  // On ne retient que ceux qui sont déclarés — un avantage contesté par le
  // créateur ou annulé par la marque ne pèse pas sur le cumul.
  const { data: inKind } = await untyped(admin)
    .from("in_kind_benefits")
    .select("value, sent_at, status")
    .eq("brand_id", brandId)
    .eq("creator_id", creatorId)
    .eq("status", "declared")
    .gte("sent_at", from.slice(0, 10))
    .lt("sent_at", to.slice(0, 10));
  const fromInKind = (inKind ?? []).reduce(
    (s: number, g: any) => s + Number(g.value ?? 0),
    0,
  );

  const total = round2(fromDeals + fromAffiliate + fromInKind);
  return {
    year,
    fromDeals: round2(fromDeals),
    fromAffiliate: round2(fromAffiliate),
    fromInKind: round2(fromInKind),
    total,
    remaining: round2(Math.max(0, LEGAL_THRESHOLD - total)),
    required: total >= LEGAL_THRESHOLD,
    approaching: total >= LEGAL_THRESHOLD * WARN_RATIO && total < LEGAL_THRESHOLD,
  };
}

/**
 * Même calcul, en projetant un montant à venir : « si j'accepte ce deal à
 * 500 €, est-ce que je bascule dans l'obligation ? »
 */
export async function thresholdWith(
  brandId: string,
  creatorId: string,
  additionalAmount: number,
): Promise<ThresholdState & { crossesWithThisDeal: boolean }> {
  const current = await thresholdFor(brandId, creatorId);
  const projected = round2(current.total + Number(additionalAmount ?? 0));
  return {
    ...current,
    total: projected,
    remaining: round2(Math.max(0, LEGAL_THRESHOLD - projected)),
    required: projected >= LEGAL_THRESHOLD,
    approaching:
      projected >= LEGAL_THRESHOLD * WARN_RATIO && projected < LEGAL_THRESHOLD,
    // Le seuil n'était pas atteint, il le devient à cause de ce deal précis.
    crossesWithThisDeal: !current.required && projected >= LEGAL_THRESHOLD,
  };
}
