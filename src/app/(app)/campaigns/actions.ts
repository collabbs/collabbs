"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";

// Sprint B v2 — Refonte : le TYPE est le modèle de paiement créateur.
// Les "assets" diffusables (code promo, concours) sont des FLAGS séparés
// activables sur n'importe quel type, pas des types exclusifs.
export type CampaignType =
  | "affiliation"
  | "video"
  | "hybrid"
  | "performance"
  | "cpa_flat"
  | "cpa_tiers";
export type ProductKind = "physical" | "digital" | "service";

export type CpaTier = { minActions: number; payout: number; label: string };

export type CampaignData = {
  type: CampaignType;
  name: string;
  description: string;
  requirements: string;
  fixedAmount: number | null;
  perfRate: number | null;
  targetUrl: string;
  minSubscribers: number | null;
  spots: number | null;
  commission: { nano: number; micro: number; mid: number; macro: number };
  niches: number[];
  platforms: number[];
  // Sprint A — Produit ciblé
  productName: string;
  productUrl: string;
  productImageUrl: string;
  productKind: ProductKind | null;
  // Sprint B v2 — CPA flat (type = cpa_flat)
  cpaActionLabel: string;
  cpaValuePerAction: number | null;
  // Sprint B v2 — Paliers CPA (type = cpa_tiers)
  cpaTiers: CpaTier[];
  // Sprint B v2 — Asset Code promo (activable sur n'importe quel type)
  withPromoCode: boolean;
  promoCode: string;
  promoAutoGenerate: boolean;
  promoDiscountPct: number | null;
  promoMinPurchase: number | null;
  promoExpiresAt: string | null;
  promoCommissionPct: number | null;
  // Sprint B v2 — Asset Concours (activable sur n'importe quel type)
  withGiveaway: boolean;
  giveawayPrizeLabel: string;
  giveawayPrizeValue: number | null;
  giveawayWinnersCount: number | null;
  giveawayRulesUrl: string;
};

export async function createCampaign(
  data: CampaignData,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const withAffiliation = data.type === "affiliation" || data.type === "hybrid";
  const withFixed = data.type === "video" || data.type === "hybrid";
  const isPerformance = data.type === "performance";
  const isCpaFlat = data.type === "cpa_flat";
  const isCpaTiers = data.type === "cpa_tiers";

  // Si la marque n'a renseigné que product_url, on le réutilise comme cible
  // d'affiliation par défaut (cas le plus courant : promotion d'1 produit).
  // Si elle a explicitement saisi targetUrl, on respecte son choix.
  const targetUrl =
    data.targetUrl.trim() || (withAffiliation ? data.productUrl.trim() : "");

  const { data: inserted, error } = await supabase
    .from("campaigns")
    .insert({
      brand_id: user.id,
      name: data.name,
      description: data.description || null,
      requirements: data.requirements || null,
      type: data.type,
      status: "active",
      target_url: targetUrl || null,
      product_name: data.productName.trim() || null,
      product_url: data.productUrl.trim() || null,
      product_image_url: data.productImageUrl.trim() || null,
      product_kind: data.productKind,
      // Asset code promo (activable sur n'importe quel type)
      with_promo_code: data.withPromoCode,
      promo_code: data.withPromoCode && !data.promoAutoGenerate
        ? data.promoCode.trim() || null
        : null,
      promo_auto_generate: data.withPromoCode ? data.promoAutoGenerate : false,
      promo_discount_pct: data.withPromoCode ? data.promoDiscountPct : null,
      promo_min_purchase: data.withPromoCode ? data.promoMinPurchase : null,
      promo_expires_at: data.withPromoCode ? data.promoExpiresAt : null,
      promo_commission_pct: data.withPromoCode ? data.promoCommissionPct : null,
      // Asset concours (activable sur n'importe quel type)
      with_giveaway: data.withGiveaway,
      giveaway_prize_label: data.withGiveaway ? data.giveawayPrizeLabel.trim() || null : null,
      giveaway_prize_value: data.withGiveaway ? data.giveawayPrizeValue : null,
      giveaway_winners_count: data.withGiveaway ? data.giveawayWinnersCount : null,
      giveaway_rules_url: data.withGiveaway ? data.giveawayRulesUrl.trim() || null : null,
      // CPA flat (X€ par action)
      cpa_action_label: isCpaFlat || isCpaTiers ? data.cpaActionLabel.trim() || null : null,
      cpa_value_per_action: isCpaFlat ? data.cpaValuePerAction : null,
      min_subscribers: data.minSubscribers,
      spots: data.spots,
      commission_type: withAffiliation
        ? "percentage"
        : isPerformance
          ? "fixed_per_action"
          : null,
      commission_value: isPerformance ? data.perfRate : null,
      commission_unit: isPerformance ? "1000 vues" : null,
      commission_nano: withAffiliation ? data.commission.nano : null,
      commission_micro: withAffiliation ? data.commission.micro : null,
      commission_mid: withAffiliation ? data.commission.mid : null,
      commission_macro: withAffiliation ? data.commission.macro : null,
      fixed_amount: withFixed ? data.fixedAmount : null,
    })
    .select("id")
    .single();
  if (error || !inserted) return { ok: false, error: error?.message ?? "Erreur." };

  // Paliers CPA — table dédiée car nombre variable de paliers par campagne.
  // Filtre les paliers vides ou invalides (mais permet le V1 simple "qty + €").
  if (isCpaTiers && data.cpaTiers.length > 0) {
    const tiersToInsert = data.cpaTiers
      .filter((t) => t.minActions > 0 && t.payout > 0)
      .sort((a, b) => a.minActions - b.minActions)
      .map((t, i) => ({
        campaign_id: inserted.id,
        min_actions: t.minActions,
        payout: t.payout,
        label: t.label.trim() || null,
        position: i,
      }));
    if (tiersToInsert.length > 0) {
      await supabase.from("campaign_cpa_tiers").insert(tiersToInsert);
    }
  }

  if (data.niches.length > 0) {
    await supabase
      .from("campaign_niches")
      .insert(data.niches.map((niche_id) => ({ campaign_id: inserted.id, niche_id })));
  }
  if (data.platforms.length > 0) {
    await supabase
      .from("campaign_platforms")
      .insert(
        data.platforms.map((platform_id) => ({ campaign_id: inserted.id, platform_id })),
      );
  }

  revalidatePath("/dashboard");
  return { ok: true, id: inserted.id };
}

/**
 * Saisie MANUELLE d'une vente attribuée à un code promo.
 * Sert aux marques qui n'ont pas (encore) intégré le postback /api/track/promo.
 * La marque déclare "le code MARTIN20 a généré 49.99€ via la commande ORD-123",
 * et Collabbs crée un affiliate_events source='promo_code'.
 */
export async function recordManualPromoSale(input: {
  campaignId: string;
  code: string;
  amount: number;
  orderRef?: string | null;
}): Promise<{ ok: boolean; error?: string; commission?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };
  if (!input.code || !Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Code et montant valide requis." };
  }

  // Vérifie que la campagne appartient bien à la marque connectée.
  const { data: c } = await supabase
    .from("campaigns")
    .select("brand_id, promo_commission_pct")
    .eq("id", input.campaignId)
    .maybeSingle();
  if (!c || c.brand_id !== user.id) {
    return { ok: false, error: "Action non autorisée." };
  }

  // Résout le lien d'affiliation correspondant à ce code promo.
  const normalized = input.code.toUpperCase().replace(/\s+/g, "");
  const { data: link } = await supabase
    .from("affiliate_links")
    .select("id, creator_id")
    .eq("campaign_id", input.campaignId)
    .eq("promo_code", normalized)
    .maybeSingle();
  if (!link) {
    return {
      ok: false,
      error: `Aucun créateur n'a le code "${normalized}" sur cette campagne.`,
    };
  }

  const pct = c.promo_commission_pct ?? 0;
  const commission = Math.round((input.amount * pct) / 100);

  const { error } = await supabase.from("affiliate_events").insert({
    link_id: link.id,
    type: "sale",
    source: "promo_code",
    sale_amount: input.amount,
    commission_amount: commission,
    external_ref: input.orderRef?.trim() || null,
  });
  if (error) {
    // Idempotent : même order_ref déjà saisi pour ce lien
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: "Vente déjà enregistrée pour cette commande." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/campaigns/${input.campaignId}`);
  return { ok: true, commission };
}

/** La marque accepte ou refuse une candidature reçue sur l'une de ses campagnes. */
export async function decideApplication(
  applicationId: string,
  decision: "accepted" | "rejected",
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // On vérifie que la candidature porte bien sur une campagne de cette marque.
  const { data: app } = await supabase
    .from("applications")
    .select("id, campaign_id, creator_id, campaigns(brand_id, name)")
    .eq("id", applicationId)
    .single();
  if (!app) return { ok: false, error: "Candidature introuvable." };
  if (app.campaigns?.brand_id !== user.id)
    return { ok: false, error: "Action non autorisée." };

  const { error } = await supabase
    .from("applications")
    .update({ status: decision })
    .eq("id", applicationId);
  if (error) return { ok: false, error: error.message };

  // Notif au créateur
  const campaignName = app.campaigns?.name ?? "ta campagne";
  if (decision === "accepted") {
    await notify({
      userId: app.creator_id,
      type: "application_accepted",
      title: `Ta candidature à "${campaignName}" a été acceptée 🎉`,
      body: "La marque te propose de collaborer. Ouvre la collaboration pour voir les prochaines étapes.",
      link: "/opportunities",
    });
  } else {
    await notify({
      userId: app.creator_id,
      type: "application_rejected",
      title: `Candidature non retenue pour "${campaignName}"`,
      body: "Ne le prends pas mal — d'autres campagnes t'attendent. Continue à explorer les opportunités.",
      link: "/opportunities",
    });
  }

  revalidatePath(`/campaigns/${app.campaign_id}`);
  return { ok: true };
}

/** La marque met sa campagne en pause (ended) ou la réactive. */
export async function setCampaignStatus(
  campaignId: string,
  status: "active" | "ended",
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { error } = await supabase
    .from("campaigns")
    .update({ status })
    .eq("id", campaignId)
    .eq("brand_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return { ok: true };
}
