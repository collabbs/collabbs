"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/landing/Logo";
import PlatformIcon from "@/components/PlatformIcon";
import {
  createCampaign,
  type CampaignType,
  type ProductKind,
  type CpaTier,
} from "../actions";

type Niche = { id: number; label: string };
type Platform = { id: number; label: string; slug: string };
type TierKey = "nano" | "micro" | "mid" | "macro";

const TIERS: { key: TierKey; label: string; range: string }[] = [
  { key: "nano", label: "Nano", range: "< 10k" },
  { key: "micro", label: "Micro", range: "10k–50k" },
  { key: "mid", label: "Mid", range: "50k–200k" },
  { key: "macro", label: "Macro", range: "> 200k" },
];

// Les types représentent le MODÈLE DE PAIEMENT créateur, pas les assets.
// Code promo / concours sont des ASSETS activables sur n'importe quel type
// (cf checkboxes plus bas).
const TYPES: { id: CampaignType; emoji: string; label: string; desc: string }[] = [
  { id: "video", emoji: "🎬", label: "Paiement fixe", desc: "Montant fixe par contenu livré" },
  { id: "affiliation", emoji: "🔗", label: "Commission %", desc: "% sur les ventes générées" },
  { id: "cpa_flat", emoji: "🎯", label: "CPA fixe", desc: "X€ par inscription / lead" },
  { id: "cpa_tiers", emoji: "📈", label: "CPA paliers", desc: "1000 inscrits = X€, 5000 = Y€…" },
  { id: "performance", emoji: "📊", label: "Aux vues", desc: "Payé aux vues du contenu" },
  { id: "hybrid", emoji: "✨", label: "Hybride", desc: "Fixe + commission" },
];

const PRODUCT_KINDS: { id: ProductKind; emoji: string; label: string; desc: string }[] = [
  { id: "physical", emoji: "📦", label: "Physique", desc: "Produit livrable" },
  { id: "digital", emoji: "💻", label: "Digital", desc: "App, SaaS, formation…" },
  { id: "service", emoji: "🛠️", label: "Service", desc: "Prestation, abo…" },
];

export default function CampaignForm({
  niches,
  platforms,
  defaultCommission,
}: {
  niches: Niche[];
  platforms: Platform[];
  defaultCommission: Record<TierKey, number>;
}) {
  const router = useRouter();
  const [type, setType] = useState<CampaignType>("affiliation");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [perfRate, setPerfRate] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  // Produit ciblé — la marque dit ce qu'elle veut promouvoir.
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [productKind, setProductKind] = useState<ProductKind | null>(null);
  // Sprint B v2 — CPA
  const [cpaActionLabel, setCpaActionLabel] = useState("");
  const [cpaValuePerAction, setCpaValuePerAction] = useState("");
  // Paliers CPA : tableau de paliers édités par la marque. On démarre vide,
  // ligne par ligne ajoutée. Les paliers sont triés par minActions au save.
  const [cpaTiers, setCpaTiers] = useState<CpaTier[]>([
    { minActions: 0, payout: 0, label: "" },
  ]);
  // Asset code promo
  const [withPromoCode, setWithPromoCode] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoAutoGenerate, setPromoAutoGenerate] = useState(false);
  const [promoDiscountPct, setPromoDiscountPct] = useState("");
  const [promoMinPurchase, setPromoMinPurchase] = useState("");
  const [promoExpiresAt, setPromoExpiresAt] = useState("");
  const [promoCommissionPct, setPromoCommissionPct] = useState("");
  // Asset concours
  const [withGiveaway, setWithGiveaway] = useState(false);
  const [giveawayPrizeLabel, setGiveawayPrizeLabel] = useState("");
  const [giveawayPrizeValue, setGiveawayPrizeValue] = useState("");
  const [giveawayWinnersCount, setGiveawayWinnersCount] = useState("");
  const [giveawayRulesUrl, setGiveawayRulesUrl] = useState("");
  const [nicheIds, setNicheIds] = useState<number[]>([]);
  const [platformIds, setPlatformIds] = useState<number[]>([]);
  const [minSubs, setMinSubs] = useState("");
  const [spots, setSpots] = useState("");
  const [commission, setCommission] = useState<Record<TierKey, string>>({
    nano: String(defaultCommission.nano),
    micro: String(defaultCommission.micro),
    mid: String(defaultCommission.mid),
    macro: String(defaultCommission.macro),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withAffiliation = type === "affiliation" || type === "hybrid";
  const withFixed = type === "video" || type === "hybrid";
  const isPerformance = type === "performance";
  const isCpaFlat = type === "cpa_flat";
  const isCpaTiers = type === "cpa_tiers";

  function updateTier(i: number, patch: Partial<CpaTier>) {
    setCpaTiers((cur) => cur.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function addTier() {
    setCpaTiers((cur) => [...cur, { minActions: 0, payout: 0, label: "" }]);
  }
  function removeTier(i: number) {
    setCpaTiers((cur) =>
      cur.length > 1 ? cur.filter((_, idx) => idx !== i) : cur,
    );
  }

  const toggle = (arr: number[], id: number) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  async function submit() {
    setError(null);
    setSaving(true);
    const num = (v: string, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    };
    const res = await createCampaign({
      type,
      name: name.trim(),
      description: description.trim(),
      requirements: requirements.trim(),
      fixedAmount: fixedAmount ? Number(fixedAmount) : null,
      perfRate: perfRate ? Number(perfRate) : null,
      targetUrl: targetUrl.trim(),
      minSubscribers: minSubs ? Number(minSubs) : null,
      spots: spots ? Number(spots) : null,
      commission: {
        nano: num(commission.nano, 3),
        micro: num(commission.micro, 5),
        mid: num(commission.mid, 8),
        macro: num(commission.macro, 12),
      },
      niches: nicheIds,
      platforms: platformIds,
      productName,
      productUrl,
      productImageUrl,
      productKind,
      cpaActionLabel,
      cpaValuePerAction: cpaValuePerAction ? Number(cpaValuePerAction) : null,
      cpaTiers: cpaTiers.map((t) => ({
        minActions: Number(t.minActions) || 0,
        payout: Number(t.payout) || 0,
        label: t.label,
      })),
      withPromoCode,
      promoCode,
      promoAutoGenerate,
      promoDiscountPct: promoDiscountPct ? Number(promoDiscountPct) : null,
      promoMinPurchase: promoMinPurchase ? Number(promoMinPurchase) : null,
      promoExpiresAt: promoExpiresAt || null,
      promoCommissionPct: promoCommissionPct ? Number(promoCommissionPct) : null,
      withGiveaway,
      giveawayPrizeLabel,
      giveawayPrizeValue: giveawayPrizeValue ? Number(giveawayPrizeValue) : null,
      giveawayWinnersCount: giveawayWinnersCount ? Number(giveawayWinnersCount) : null,
      giveawayRulesUrl,
    });
    if (res.ok) {
      router.push("/dashboard");
    } else {
      setError(res.error ?? "Une erreur est survenue.");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-400 transition hover:text-ink"
        >
          Annuler
        </Link>
      </div>

      <h1 className="mt-8 font-display text-3xl font-black tracking-tight text-ink">
        Nouvelle campagne
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Les créateurs qui correspondent la verront et pourront candidater ou activer
        leur lien d&apos;affiliation.
      </p>

      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Modèle de paiement créateur
      </p>
      {/* Type de campagne = MODÈLE DE PAIEMENT créateur (vs assets diffusés
          qui sont activables séparément plus bas dans le form). */}
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TYPES.map((t) => {
          const active = type === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`rounded-xl border p-4 text-left transition ${
                active
                  ? "border-transparent bg-gradient-to-br from-purple-50 to-pink-50 ring-2 ring-purple-300"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <span className="text-xl">{t.emoji}</span>
              <p className="mt-1 text-sm font-semibold text-ink">{t.label}</p>
              <p className="text-xs text-zinc-500">{t.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Brief */}
      <div className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink">
            Nom de la campagne
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Lancement gamme été"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Présente ton produit, l'offre, le message clé…"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Ce que tu attends des créateurs{" "}
            <span className="text-zinc-400">(optionnel)</span>
          </label>
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={2}
            placeholder="Ex : mention en story + lien en bio, ton authentique…"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
      </div>

      {/* Produit ciblé — optionnel mais fortement recommandé : c'est ce que
          la marque souhaite mettre en avant. Sans ces champs, la fiche
          créateur reste vague sur ce qu'il y a à promouvoir. */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Quel produit met-on en avant ? <span className="text-zinc-300">(optionnel)</span>
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Si tu veux promouvoir un produit précis (vs ton catalogue entier),
        renseigne-le ici — il s&apos;affichera sur la fiche du créateur.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {PRODUCT_KINDS.map((k) => {
          const active = productKind === k.id;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setProductKind(active ? null : k.id)}
              className={`rounded-xl border p-3 text-left transition ${
                active
                  ? "border-transparent bg-gradient-to-br from-purple-50 to-pink-50 ring-2 ring-purple-300"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <span className="text-lg">{k.emoji}</span>
              <p className="mt-0.5 text-xs font-semibold text-ink">{k.label}</p>
              <p className="text-[11px] text-zinc-500">{k.desc}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-ink">
            Nom du produit
          </label>
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Ex : Sérum acide hyaluronique 30ml"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Lien vers le produit
          </label>
          <input
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            inputMode="url"
            placeholder="https://ta-marque.com/produit"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
          <p className="mt-1 text-xs text-zinc-400">
            {withAffiliation
              ? "Sera aussi utilisé comme cible des liens d'affiliation si tu n'en spécifies pas une autre plus bas."
              : "C'est où le créateur enverra ses abonnés."}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Image produit{" "}
            <span className="text-zinc-400">(URL)</span>
          </label>
          <input
            value={productImageUrl}
            onChange={(e) => setProductImageUrl(e.target.value)}
            inputMode="url"
            placeholder="https://ta-marque.com/img/produit.jpg"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
          {productImageUrl.trim() && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={productImageUrl}
              alt="Aperçu produit"
              className="mt-2 h-24 w-24 rounded-lg border border-zinc-200 object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
      </div>

      {/* Ciblage */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Ciblage
      </h2>
      <div className="mt-3">
        <label className="block text-sm font-medium text-ink">Niches</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {niches.map((n) => {
            const active = nicheIds.includes(n.id);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setNicheIds((c) => toggle(c, n.id))}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-ink text-white"
                    : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {n.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium text-ink">Réseaux</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {platforms.map((p) => {
            const active = platformIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatformIds((c) => toggle(c, p.id))}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-ink text-white"
                    : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                <PlatformIcon slug={p.slug} className="h-4 w-4" />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">
            Abonnés min. <span className="text-zinc-400">(optionnel)</span>
          </label>
          <input
            value={minSubs}
            onChange={(e) => setMinSubs(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="Ex : 10000"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Places <span className="text-zinc-400">(optionnel)</span>
          </label>
          <input
            value={spots}
            onChange={(e) => setSpots(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="Ex : 20"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
      </div>

      {/* Budget fixe (vidéo / hybride) */}
      {withFixed && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Budget
          </h2>
          <label className="mt-3 block text-sm font-medium text-ink">
            Montant fixe par créateur
          </label>
          <div className="mt-1.5 flex w-48 items-center rounded-lg border border-zinc-300 px-3">
            <input
              value={fixedAmount}
              onChange={(e) => setFixedAmount(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="500"
              className="w-full py-2.5 text-sm outline-none"
            />
            <span className="text-sm text-zinc-400">€</span>
          </div>
        </div>
      )}

      {/* CPA flat — X€ par action déclarée. Le libellé est important pour
          que le créateur comprenne ce qu'il "vend" (inscription, lead, achat). */}
      {isCpaFlat && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Paiement par action
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Le créateur est payé un montant fixe pour chaque action déclarée
            (inscription au service, lead qualifié, premier achat…).
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink">Type d&apos;action</label>
              <input
                value={cpaActionLabel}
                onChange={(e) => setCpaActionLabel(e.target.value)}
                placeholder="inscription"
                className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
              />
              <p className="mt-1 text-xs text-zinc-400">
                Ex : inscription, lead, demande de démo…
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">Montant par action</label>
              <div className="mt-1.5 flex items-center rounded-lg border border-zinc-300 px-3">
                <input
                  value={cpaValuePerAction}
                  onChange={(e) =>
                    setCpaValuePerAction(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  inputMode="numeric"
                  placeholder="5"
                  className="w-full py-2.5 text-sm outline-none"
                />
                <span className="text-sm text-zinc-400">€</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CPA paliers — cas Revolut : "1000 inscrits = 200€, 5000 = 1000€" */}
      {isCpaTiers && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Paliers d&apos;actions
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Le créateur touche le palier le plus haut atteint. Ex : 1000
            inscriptions = 200€, 5000 = 1000€, 20000 = 5000€.
          </p>
          <div className="mt-3">
            <label className="block text-sm font-medium text-ink">
              Type d&apos;action
            </label>
            <input
              value={cpaActionLabel}
              onChange={(e) => setCpaActionLabel(e.target.value)}
              placeholder="inscription"
              className="mt-1.5 w-48 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
            />
          </div>
          <div className="mt-4 space-y-2">
            {cpaTiers.map((t, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 rounded-xl border border-zinc-200 bg-white p-3"
              >
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                    À partir de
                  </label>
                  <div className="mt-1 flex items-center rounded-lg border border-zinc-300 px-2">
                    <input
                      value={t.minActions || ""}
                      onChange={(e) =>
                        updateTier(i, {
                          minActions: Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                        })
                      }
                      inputMode="numeric"
                      placeholder="1000"
                      className="w-full py-2 text-sm outline-none"
                    />
                    <span className="text-xs text-zinc-400">actions</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                    Payout
                  </label>
                  <div className="mt-1 flex items-center rounded-lg border border-zinc-300 px-2">
                    <input
                      value={t.payout || ""}
                      onChange={(e) =>
                        updateTier(i, {
                          payout: Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                        })
                      }
                      inputMode="numeric"
                      placeholder="200"
                      className="w-full py-2 text-sm outline-none"
                    />
                    <span className="text-xs text-zinc-400">€</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                    Label <span className="text-zinc-300">(opt.)</span>
                  </label>
                  <input
                    value={t.label}
                    onChange={(e) => updateTier(i, { label: e.target.value })}
                    placeholder="Bronze"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeTier(i)}
                  disabled={cpaTiers.length === 1}
                  className="rounded-lg px-2 py-2 text-zinc-400 transition hover:text-red-500 disabled:opacity-30"
                  aria-label="Supprimer le palier"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTier}
              className="text-xs font-semibold text-brand hover:underline"
            >
              + Ajouter un palier
            </button>
          </div>
        </div>
      )}

      {/* Performance (payé aux vues) */}
      {isPerformance && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Rémunération à la performance
          </h2>
          <label className="mt-3 block text-sm font-medium text-ink">
            Montant par tranche de vues
          </label>
          <div className="mt-1.5 flex w-56 items-center gap-2 rounded-lg border border-zinc-300 px-3">
            <input
              value={perfRate}
              onChange={(e) => setPerfRate(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="5"
              className="w-full py-2.5 text-sm outline-none"
            />
            <span className="whitespace-nowrap text-sm text-zinc-400">
              € / 1000 vues
            </span>
          </div>
        </div>
      )}

      {/* Commission (affiliation / hybride) */}
      {withAffiliation && (
        <div className="mt-8">
          <label className="block text-sm font-medium text-ink">
            Lien de destination
          </label>
          <p className="mt-0.5 text-xs text-zinc-400">
            Où le lien d&apos;affiliation du créateur enverra le trafic (ta page produit).
          </p>
          <input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            inputMode="url"
            placeholder="https://ta-marque.com/produit"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Commission d&apos;affiliation
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Le % reversé au créateur sur chaque vente, selon sa taille d&apos;audience.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TIERS.map((t) => (
              <div key={t.key} className="rounded-xl border border-zinc-200 p-3">
                <p className="text-sm font-semibold text-ink">{t.label}</p>
                <p className="text-xs text-zinc-400">{t.range}</p>
                <div className="mt-2 flex items-center rounded-lg border border-zinc-300 px-2">
                  <input
                    value={commission[t.key]}
                    onChange={(e) =>
                      setCommission((c) => ({
                        ...c,
                        [t.key]: e.target.value.replace(/[^0-9]/g, "").slice(0, 3),
                      }))
                    }
                    inputMode="numeric"
                    className="w-full py-2 text-right text-sm outline-none"
                  />
                  <span className="text-sm text-zinc-400">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assets diffusés — activables sur N'IMPORTE QUEL type de campagne.
          Une campagne peut donc être "video fixe + code promo tracké + concours"
          simultanément. C'est le point clé de la refonte. */}
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Bonus à diffuser <span className="text-zinc-300">(optionnel)</span>
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        En plus du paiement créateur, qu&apos;est-ce qu&apos;on offre à
        l&apos;audience pour la convaincre ? (Coche les assets activés.)
      </p>

      <div className="mt-3 space-y-3">
        {/* Asset CODE PROMO */}
        <div
          className={`rounded-2xl border p-4 transition ${
            withPromoCode
              ? "border-fuchsia-300 bg-gradient-to-br from-fuchsia-50/60 to-pink-50/40"
              : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={withPromoCode}
              onChange={(e) => setWithPromoCode(e.target.checked)}
              className="mt-1 h-4 w-4 accent-fuchsia-600"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-ink">
                🎟️ Code promo tracké
              </p>
              <p className="text-xs text-zinc-500">
                Le créateur reçoit un code à diffuser. Les ventes via ce code
                sont remontées à Collabbs (postback ou saisie manuelle) et
                rémunérées avec une commission spécifique.
              </p>
            </div>
          </label>

          {withPromoCode && (
            <div className="mt-4 space-y-3 pl-7">
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPromoAutoGenerate(false)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    !promoAutoGenerate
                      ? "border-fuchsia-400 bg-white ring-2 ring-fuchsia-200"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <p className="text-xs font-bold text-ink">
                    🎟️ Code unique partagé
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Tu fournis un code (ex : ETE20). Tous les créateurs le
                    diffusent — moins d&apos;attribution par créateur.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setPromoAutoGenerate(true)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    promoAutoGenerate
                      ? "border-fuchsia-400 bg-white ring-2 ring-fuchsia-200"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <p className="text-xs font-bold text-ink">
                    ✨ Codes auto par créateur
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Collabbs génère 1 code par créateur (ex : MARTIN20) —
                    attribution propre.
                  </p>
                </button>
              </div>

              {!promoAutoGenerate && (
                <div>
                  <label className="block text-xs font-medium text-ink">
                    Code promo
                  </label>
                  <input
                    value={promoCode}
                    onChange={(e) =>
                      setPromoCode(e.target.value.toUpperCase().replace(/\s+/g, ""))
                    }
                    placeholder="ETE20"
                    className="mt-1 w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono outline-none focus:border-fuchsia-400"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-ink">
                    Réduction <span className="text-zinc-400">(%)</span>
                  </label>
                  <div className="mt-1 flex items-center rounded-lg border border-zinc-300 px-2">
                    <input
                      value={promoDiscountPct}
                      onChange={(e) =>
                        setPromoDiscountPct(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))
                      }
                      inputMode="numeric"
                      placeholder="20"
                      className="w-full py-2 text-sm outline-none"
                    />
                    <span className="text-xs text-zinc-400">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink">
                    Min. achat
                  </label>
                  <div className="mt-1 flex items-center rounded-lg border border-zinc-300 px-2">
                    <input
                      value={promoMinPurchase}
                      onChange={(e) =>
                        setPromoMinPurchase(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      inputMode="numeric"
                      placeholder="50"
                      className="w-full py-2 text-sm outline-none"
                    />
                    <span className="text-xs text-zinc-400">€</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink">
                    Expire le
                  </label>
                  <input
                    type="date"
                    value={promoExpiresAt}
                    onChange={(e) => setPromoExpiresAt(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm outline-none focus:border-fuchsia-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">
                  Commission créateur sur ventes via le code{" "}
                  <span className="text-zinc-400">(%)</span>
                </label>
                <div className="mt-1 flex w-48 items-center rounded-lg border border-zinc-300 px-2">
                  <input
                    value={promoCommissionPct}
                    onChange={(e) =>
                      setPromoCommissionPct(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))
                    }
                    inputMode="numeric"
                    placeholder="10"
                    className="w-full py-2 text-sm outline-none"
                  />
                  <span className="text-xs text-zinc-400">%</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Le créateur touche ce % sur les ventes attribuées à son code.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Asset CONCOURS */}
        <div
          className={`rounded-2xl border p-4 transition ${
            withGiveaway
              ? "border-amber-300 bg-gradient-to-br from-amber-50/60 to-yellow-50/40"
              : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={withGiveaway}
              onChange={(e) => setWithGiveaway(e.target.checked)}
              className="mt-1 h-4 w-4 accent-amber-600"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-ink">🎁 Concours / Cadeau</p>
              <p className="text-xs text-zinc-500">
                Argument marketing : la communauté du créateur peut gagner un
                lot. Tu gères le tirage et l&apos;envoi — Collabbs affiche
                juste l&apos;info au créateur.
              </p>
            </div>
          </label>

          {withGiveaway && (
            <div className="mt-4 space-y-3 pl-7">
              <div>
                <label className="block text-xs font-medium text-ink">
                  Lot à gagner
                </label>
                <input
                  value={giveawayPrizeLabel}
                  onChange={(e) => setGiveawayPrizeLabel(e.target.value)}
                  placeholder="Ex : 5000€ en cash"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink">Valeur</label>
                  <div className="mt-1 flex items-center rounded-lg border border-zinc-300 px-2">
                    <input
                      value={giveawayPrizeValue}
                      onChange={(e) =>
                        setGiveawayPrizeValue(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      inputMode="numeric"
                      placeholder="5000"
                      className="w-full py-2 text-sm outline-none"
                    />
                    <span className="text-xs text-zinc-400">€</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink">Gagnants</label>
                  <div className="mt-1 flex items-center rounded-lg border border-zinc-300 px-2">
                    <input
                      value={giveawayWinnersCount}
                      onChange={(e) =>
                        setGiveawayWinnersCount(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      inputMode="numeric"
                      placeholder="1"
                      className="w-full py-2 text-sm outline-none"
                    />
                    <span className="text-xs text-zinc-400">pers.</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink">
                  Lien règlement <span className="text-zinc-400">(opt.)</span>
                </label>
                <input
                  value={giveawayRulesUrl}
                  onChange={(e) => setGiveawayRulesUrl(e.target.value)}
                  inputMode="url"
                  placeholder="https://ta-marque.com/concours-reglement"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={name.trim().length === 0 || saving}
          className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Publication…" : "Publier la campagne"}
        </button>
      </div>
    </main>
  );
}
