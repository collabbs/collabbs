"use server";

import { createClient } from "@/lib/supabase/server";
import { OFFER_BY_ID } from "@/components/landing/creators";
import { normaliserCarteMarque, type CarteMarque } from "@/lib/quiz";
import { createCampaign, type CampaignType } from "./actions";

/**
 * Transformer le questionnaire d'une marque en vraie campagne.
 *
 * ─── Le trou qu'elle bouche ───
 * Une marque remplissait tout le questionnaire — son site, ce qu'elle vend,
 * les formats, le budget, l'échéance, et surtout SON VISUEL — puis créait son
 * compte… et tout était jeté. Rien, en dehors de `/commencer`, ne relisait
 * jamais sa carte. Elle devait tout retaper dans le formulaire de campagne.
 *
 * Conséquence directe pour le défilé : une marque qui arrive ne pouvait pas
 * en ressortir avec une carte. Le questionnaire montrait un aperçu, et
 * l'aperçu ne devenait rien.
 *
 * ─── Ce qu'on reprend, et ce qu'on ne devine pas ───
 * On reprend ce que la marque a réellement dit. On ne fabrique ni niches ni
 * places ni audience minimale : inventer ses critères de ciblage à sa place
 * serait pire que de les laisser vides, elle les corrigera d'un coup d'œil.
 *
 * On passe par `createCampaign` plutôt que d'écrire en base : toutes les
 * règles métier — capacité du plan, validation, cohérence des commissions —
 * sont là-dedans, et une seconde porte d'entrée qui les contourne finirait
 * par diverger.
 */

/** Le mode de rémunération choisi décide du type de campagne. */
function typeDepuis(remuneration: CarteMarque["remuneration"]): CampaignType {
  if (remuneration === "commission") return "affiliation";
  if (remuneration === "les-deux") return "hybrid";
  return "video";
}

/** Un intitulé lisible à partir des formats demandés. */
function intitule(carte: CarteMarque): string {
  const labels = carte.formats.map((id) => OFFER_BY_ID[id]?.short).filter(Boolean);
  if (labels.length === 0) return "Collaboration créateurs";
  return `${labels.join(" + ")} — recherche créateurs`;
}

export async function creerCampagneDepuisCarte(
  brute: unknown,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  // La carte vient du navigateur : elle a pu être bricolée ou corrompue.
  // `normaliserCarteMarque` est la même réparation que celle du questionnaire.
  const carte = normaliserCarteMarque(brute);
  if (!carte) return { ok: false, error: "Questionnaire illisible." };
  // Le modèle « marque » se passe de photo : c'est le logo qui porte la carte.
  if (carte.modele === "photo" && !carte.visuel) {
    return { ok: false, error: "Il manque le visuel." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // Le site sert au-delà de la campagne : c'est lui qui donne à la carte son
  // logo et sa couleur dans le défilé. On ne l'écrase pas s'il est déjà là.
  if (carte.site) {
    const { data: marque } = await supabase
      .from("brands")
      .select("website")
      .eq("id", user.id)
      .maybeSingle();
    if (marque && !marque.website) {
      await supabase.from("brands").update({ website: carte.site }).eq("id", user.id);
    }
  }

  // Une seule commission au questionnaire : on la met sur les quatre paliers.
  // Les distinguer par taille d'audience est un réglage fin, qui n'a pas sa
  // place dans un questionnaire de quatre questions.
  const taux = carte.commission ?? 0;

  return createCampaign({
    name: intitule(carte),
    type: typeDepuis(carte.remuneration),
    description: carte.produit ?? "",
    requirements: "",
    fixedAmount: carte.montant,
    perfRate: null,
    targetUrl: carte.site ?? "",
    attributionDays: null,
    minSubscribers: null,
    spots: null,
    commission: { nano: taux, micro: taux, mid: taux, macro: taux },
    niches: [],
    platforms: [],
    productName: carte.nom ?? "",
    productUrl: carte.site ?? "",
    productImageUrl: carte.modele === "photo" ? (carte.visuel ?? "") : "",
    productKind: null,
    cpaActionLabel: "",
    cpaValuePerAction: null,
    cpaTiers: [],
    withPromoCode: false,
    promoCode: "",
    promoAutoGenerate: false,
    promoDiscountPct: null,
    promoMinPurchase: null,
    promoExpiresAt: null,
    promoCommissionPct: null,
    withGiveaway: false,
    giveawayPrizeLabel: "",
    giveawayPrizeValue: null,
    giveawayWinnersCount: null,
    giveawayRulesUrl: "",
  });
}
