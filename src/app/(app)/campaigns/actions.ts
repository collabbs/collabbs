"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { settleSale } from "@/lib/affiliate-billing";
import { valider } from "@/lib/validation";
import { valeursCampagneSchema, grilleCommissionSchema } from "@/lib/schemas/campaigns";
import { reportError } from "@/lib/report-error";

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
): Promise<{ ok: boolean; error?: string; id?: string; warning?: string }> {
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

  // Aucune de ces valeurs n'était vérifiée : elles partaient du formulaire
  // directement en base. La plus dangereuse est le taux de commission — une
  // virgule mal placée donne 500 %, soit 500 € de commission plus 125 € de
  // frais sur une vente de 100 €, réservés dès la première vente sur la
  // provision de la marque.
  const chiffres = valider(valeursCampagneSchema, {
    fixedAmount: data.fixedAmount,
    perfRate: data.perfRate,
    cpaValuePerAction: data.cpaValuePerAction,
    minSubscribers: data.minSubscribers,
    spots: data.spots,
    promoDiscountPct: data.promoDiscountPct,
    promoCommissionPct: data.promoCommissionPct,
    promoMinPurchase: data.promoMinPurchase,
    giveawayPrizeValue: data.giveawayPrizeValue,
    giveawayWinnersCount: data.giveawayWinnersCount,
  });
  if (!chiffres.ok) return { ok: false, error: chiffres.error };

  if (withAffiliation) {
    const grille = valider(grilleCommissionSchema, data.commission);
    if (!grille.ok) return { ok: false, error: grille.error };
  }

  // Une campagne doit annoncer ce qu'elle paie. Sans ce contrôle, on pouvait
  // publier une campagne « Paiement fixe » à 0 € : elle s'affichait « 0€ par
  // contenu » dans le fil des créateurs, et la candidature acceptée créait une
  // collaboration à 0 €. La rémunération n'est pas un détail de formulaire,
  // c'est la seule raison qu'a un créateur de répondre.
  const remuneration = ((): string | null => {
    if (withFixed && !(data.fixedAmount && data.fixedAmount > 0))
      return "Indique le montant que tu paies par contenu : une campagne à 0 € n'attirera personne.";
    if (isPerformance && !(data.perfRate && data.perfRate > 0))
      return "Indique ce que tu paies pour 1 000 vues.";
    if (isCpaFlat && !(data.cpaValuePerAction && data.cpaValuePerAction > 0))
      return "Indique le montant versé par action réalisée.";
    if (isCpaTiers && !data.cpaTiers.some((t) => t.minActions > 0 && t.payout > 0))
      return "Renseigne au moins un palier : un nombre d'actions et le montant correspondant.";
    if (
      withAffiliation &&
      !(
        data.commission.nano > 0 ||
        data.commission.micro > 0 ||
        data.commission.mid > 0 ||
        data.commission.macro > 0
      )
    )
      return "Renseigne au moins une commission : à 0 %, le créateur ne gagne rien sur les ventes qu'il apporte.";
    return null;
  })();
  if (remuneration) return { ok: false, error: remuneration };

  // Le code promo est un chemin d'argent à part : les ventes qui passent par
  // lui sont payées avec `promo_commission_pct`, pas avec la grille
  // d'affiliation. À 0 %, le créateur diffuse un code et ne touche rien —
  // sans que rien ne le lui dise.
  if (data.withPromoCode && !(data.promoCommissionPct && data.promoCommissionPct > 0)) {
    return {
      ok: false,
      error:
        "Indique la commission versée sur les ventes passées par le code promo : à 0 %, le créateur diffuse ton code sans rien gagner.",
    };
  }

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
      const { error: errPaliers } = await supabase
        .from("campaign_cpa_tiers")
        .insert(tiersToInsert);
      // Une campagne à paliers sans palier n'annonce aucune rémunération.
      if (errPaliers) {
        await reportError("campagne/paliers", errPaliers, {
          userId: user.id,
          detail: `campagne ${inserted.id}`,
        });
      }
    }
  }

  // Niches et réseaux ne sont pas décoratifs : le fil des créateurs FILTRE
  // dessus. Une campagne dont l'insertion échoue ici existe, se paie, et
  // n'est proposée à personne — le pire des états, parce qu'il ne ressemble
  // pas à une panne.
  if (data.niches.length > 0) {
    const { error: errNiches } = await supabase
      .from("campaign_niches")
      .insert(data.niches.map((niche_id) => ({ campaign_id: inserted.id, niche_id })));
    if (errNiches) {
      await reportError("campagne/niches", errNiches, {
        userId: user.id,
        detail: `campagne ${inserted.id}`,
      });
    }
  }
  if (data.platforms.length > 0) {
    const { error: errReseaux } = await supabase
      .from("campaign_platforms")
      .insert(
        data.platforms.map((platform_id) => ({ campaign_id: inserted.id, platform_id })),
      );
    if (errReseaux) {
      await reportError("campagne/reseaux", errReseaux, {
        userId: user.id,
        detail: `campagne ${inserted.id}`,
      });
      // La campagne existe : la recréer ferait un doublon. On la rend visible
      // et on dit quoi faire.
      return {
        ok: true,
        id: inserted.id,
        warning:
          "Ta campagne est créée, mais les réseaux n'ont pas pu être enregistrés — sans eux, les créateurs ne la verront pas dans leur fil. Ouvre-la et enregistre-les à nouveau.",
      };
    }
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
}): Promise<{ ok: boolean; error?: string; commission?: number; warning?: string }> {
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
  // Au centime : on manipule désormais de l'argent réellement versé.
  const commission = Math.round(input.amount * pct) / 100;

  const { data: inserted, error } = await supabase
    .from("affiliate_events")
    .insert({
      link_id: link.id,
      type: "sale",
      // Non financée tant que la réservation sur la provision n'a pas abouti.
      status: "unfunded",
      source: "promo_code",
      sale_amount: input.amount,
      commission_amount: commission,
      external_ref: input.orderRef?.trim() || null,
    })
    .select("id")
    .single();
  if (error) {
    // Idempotent : même order_ref déjà saisi pour ce lien
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: "Vente déjà enregistrée pour cette commande." };
    }
    return { ok: false, error: error.message };
  }

  // Réserve la commission + les frais Collabbs sur la provision de la marque.
  const settlement = await settleSale({
    eventId: inserted.id,
    brandId: user.id,
    creatorId: link.creator_id,
    commission,
    saleAmount: input.amount,
  });

  revalidatePath(`/campaigns/${input.campaignId}`);
  revalidatePath("/billing");

  if (settlement === "unfunded") {
    return {
      ok: true,
      commission,
      warning:
        "Vente enregistrée, mais ta provision ne la couvre pas. Recharge ton compte pour que le créateur soit payé.",
    };
  }
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
