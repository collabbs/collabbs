"use client";

import { useState } from "react";
import Link from "next/link";
import PlatformIcon from "@/components/PlatformIcon";
import { activateAffiliateLink, applyToCampaign } from "./actions";

export type Opportunity = {
  id: string;
  name: string;
  description: string | null;
  // Sprint B v2 : types = modèles de paiement créateur uniquement.
  // promo_code/giveaway sont devenus des FLAGS (cf withPromoCode/withGiveaway).
  type:
    | "affiliation"
    | "video"
    | "hybrid"
    | "performance"
    | "cpa_flat"
    | "cpa_tiers";
  fixedAmount: number | null;
  commissionValue: number | null;
  tiers: { nano: number | null; macro: number | null };
  minSubscribers: number | null;
  spots: number | null;
  brandName: string;
  brandLogo: string | null;
  niches: string[];
  platforms: { label: string; slug: string }[];
  // Sprint B v2 — CPA
  cpaActionLabel: string | null;
  cpaValuePerAction: number | null;
  cpaTopTierPayout: number | null;
  // Sprint B v2 — assets affichés en mini-badge sur la card
  withPromoCode: boolean;
  promoDiscountPct: number | null;
  withGiveaway: boolean;
  giveawayPrizeLabel: string | null;
  giveawayPrizeValue: number | null;
};

const TYPE_META: Record<
  Opportunity["type"],
  { label: string; short: string; emoji: string; ring: string; bg: string; pill: string }
> = {
  affiliation: {
    label: "Affiliation",
    short: "Affil",
    emoji: "🔗",
    ring: "ring-emerald-200",
    bg: "from-emerald-50 to-teal-50",
    pill: "bg-emerald-100 text-emerald-800",
  },
  video: {
    label: "Paiement fixe",
    short: "Fixe",
    emoji: "🎬",
    ring: "ring-purple-200",
    bg: "from-purple-50 to-pink-50",
    pill: "bg-purple-100 text-purple-800",
  },
  performance: {
    label: "Performance",
    short: "Perf",
    emoji: "📊",
    ring: "ring-amber-200",
    bg: "from-amber-50 to-orange-50",
    pill: "bg-amber-100 text-amber-800",
  },
  hybrid: {
    label: "Hybride",
    short: "Hybr",
    emoji: "💎",
    ring: "ring-cyan-200",
    bg: "from-cyan-50 to-purple-50",
    pill: "bg-gradient-to-r from-cyan-100 to-purple-100 text-cyan-800",
  },
  cpa_flat: {
    label: "CPA fixe",
    short: "CPA",
    emoji: "🎯",
    ring: "ring-emerald-200",
    bg: "from-emerald-50 to-teal-50",
    pill: "bg-emerald-100 text-emerald-800",
  },
  cpa_tiers: {
    label: "Paliers",
    short: "Paliers",
    emoji: "📈",
    ring: "ring-emerald-200",
    bg: "from-emerald-50 to-teal-50",
    pill: "bg-emerald-100 text-emerald-800",
  },
};

function rewardParts(o: Opportunity): { main: string; sub: string } {
  switch (o.type) {
    case "affiliation":
      return {
        main: `${o.tiers.nano ?? "?"}–${o.tiers.macro ?? "?"}%`,
        sub: "de commission",
      };
    case "video":
      return o.fixedAmount
        ? { main: `${o.fixedAmount}€`, sub: "par contenu" }
        : { main: "Fixe", sub: "à définir" };
    case "performance":
      return o.commissionValue
        ? { main: `${o.commissionValue}€`, sub: "pour 1 000 vues" }
        : { main: "Perf", sub: "à définir" };
    case "hybrid":
      return {
        main: `${o.fixedAmount ?? 0}€`,
        sub: `+ ${o.tiers.nano ?? "?"}–${o.tiers.macro ?? "?"}% comm.`,
      };
    case "cpa_flat":
      return o.cpaValuePerAction
        ? { main: `${o.cpaValuePerAction}€`, sub: `par ${o.cpaActionLabel ?? "action"}` }
        : { main: "CPA", sub: "à définir" };
    case "cpa_tiers":
      return o.cpaTopTierPayout
        ? {
            main: `${o.cpaTopTierPayout.toLocaleString("fr-FR")}€`,
            sub: "au palier max",
          }
        : { main: "Paliers", sub: "à définir" };
  }
}

/**
 * Projection rapide "jusqu'à X€/mois" pour donner envie sur la card.
 * Heuristiques :
 * - affiliation/hybrid : 10 ventes/mois × 50€ panier × commission max
 * - video : amount fixe × 4 contenus/mois
 * - performance : 100k vues × valeur/1000
 */
function monthlyProjection(o: Opportunity): string | null {
  switch (o.type) {
    case "affiliation": {
      const pct = o.tiers.macro;
      if (!pct) return null;
      const monthly = Math.round((10 * 50 * pct) / 100);
      return monthly > 0 ? `jusqu'à ~${monthly}€/mois` : null;
    }
    case "hybrid": {
      const fix = o.fixedAmount ?? 0;
      const pct = o.tiers.macro ?? 0;
      const monthly = Math.round(fix * 2 + (10 * 50 * pct) / 100);
      return monthly > 0 ? `jusqu'à ~${monthly}€/mois` : null;
    }
    case "video": {
      const amt = o.fixedAmount;
      if (!amt) return null;
      return `≈ ${amt * 4}€ pour 4 contenus`;
    }
    case "performance": {
      const v = o.commissionValue;
      if (!v) return null;
      return `≈ ${v * 100}€ pour 100k vues`;
    }
    case "cpa_flat": {
      const v = o.cpaValuePerAction;
      if (!v) return null;
      // Heuristique : 100 actions/mois pour une campagne CPA crédible.
      return `≈ ${v * 100}€ pour 100 ${o.cpaActionLabel ?? "actions"}`;
    }
    case "cpa_tiers": {
      const top = o.cpaTopTierPayout;
      return top ? `jusqu'à ${top.toLocaleString("fr-FR")}€` : null;
    }
  }
}

function isPremium(o: Opportunity): boolean {
  if (o.type === "video" || o.type === "hybrid") {
    return (o.fixedAmount ?? 0) >= 500;
  }
  if (o.type === "affiliation") {
    return (o.tiers.macro ?? 0) >= 20;
  }
  return false;
}

export default function OpportunityCard({
  opportunity,
  initialStatus,
  initialCode,
  clicks = 0,
  gains = 0,
}: {
  opportunity: Opportunity;
  initialStatus: "none" | "linked" | "applied";
  initialCode?: string;
  clicks?: number;
  gains?: number;
}) {
  const o = opportunity;
  const isAffiliation = o.type === "affiliation" || o.type === "hybrid";
  const [status, setStatus] = useState(initialStatus);
  const [code, setCode] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = TYPE_META[o.type];
  const reward = rewardParts(o);
  const projection = monthlyProjection(o);
  const premium = isPremium(o);
  const urgent = o.spots !== null && o.spots <= 3 && o.spots > 0;
  const brandInitials = o.brandName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function onActivate() {
    setBusy(true);
    setError(null);
    const res = await activateAffiliateLink(o.id);
    setBusy(false);
    if (res.ok && res.code) {
      setCode(res.code);
      setStatus("linked");
    } else setError(res.error ?? "Erreur.");
  }
  async function onApply() {
    setBusy(true);
    setError(null);
    const res = await applyToCampaign(o.id);
    setBusy(false);
    if (res.ok) setStatus("applied");
    else setError(res.error ?? "Erreur.");
  }

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-xl">
      {/* Bandeau marque XL — la vraie star de la card */}
      <Link
        href={`/opportunities/${o.id}`}
        className={`relative block bg-gradient-to-br ${meta.bg} p-5 transition group-hover:from-white`}
      >
        {/* Badges en haut : Premium uniquement (on simplifie) */}
        {premium && (
          <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            ★ Premium
          </span>
        )}
        {urgent && !premium && (
          <span className="absolute right-3 top-3 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            🔥 Urgent
          </span>
        )}

        <div className="flex items-center gap-3">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-2 ${meta.ring}`}
          >
            {o.brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={o.brandLogo}
                alt={o.brandName}
                className="h-full w-full object-contain p-1.5"
              />
            ) : (
              <span className="text-xs font-bold text-zinc-500">
                {brandInitials}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              {o.brandName}
            </p>
            <h3 className="truncate font-display text-base font-black leading-tight text-ink transition group-hover:text-brand">
              {o.name}
            </h3>
          </div>
        </div>

        {/* Type badge + assets bonus sous le bandeau. Les assets sont des
            mini-badges qui montrent qu'en plus du modèle de paiement
            principal, il y a des bonus à diffuser (code promo, concours). */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.pill}`}>
            <span>{meta.emoji}</span>
            <span>{meta.label}</span>
          </span>
          {o.withPromoCode && (
            <span className="flex items-center gap-1 rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-bold text-fuchsia-800">
              🎟️ {o.promoDiscountPct ? `-${o.promoDiscountPct}%` : "Code promo"}
            </span>
          )}
          {o.withGiveaway && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              🎁{" "}
              {o.giveawayPrizeValue
                ? `${o.giveawayPrizeValue}€ à gagner`
                : "Concours"}
            </span>
          )}
          {urgent && premium && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              🔥 {o.spots} place{o.spots && o.spots > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5 pt-4">
        {/* Reward XL — gradient money/emerald qui crie "tu gagnes" */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-emerald-100/40 to-teal-50 p-4 shadow-sm">
          <div className="flex items-baseline gap-2">
            <p className="font-display text-3xl font-black leading-none tracking-tight text-emerald-700">
              {reward.main}
            </p>
            <p className="text-xs font-medium text-emerald-700/80">{reward.sub}</p>
          </div>
          {projection && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-emerald-800">
              <span>💸</span>
              {projection}
            </p>
          )}
        </div>

        {/* Description */}
        {o.description && (
          <p className="mt-3 line-clamp-2 text-sm text-zinc-600">{o.description}</p>
        )}

        {/* Plateformes + niches — limités pour ne pas déborder */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {o.platforms.slice(0, 3).map((p) => (
            <span
              key={p.slug}
              className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200"
            >
              <PlatformIcon slug={p.slug} className="h-3 w-3" />
              {p.label}
            </span>
          ))}
          {o.niches.slice(0, 2).map((n) => (
            <span
              key={n}
              className="truncate rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-brand-deep"
            >
              {n}
            </span>
          ))}
        </div>

        {/* Méta : abonnés min + places */}
        {(o.minSubscribers || (o.spots !== null && o.spots > 0)) && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
            {o.minSubscribers !== null && (
              <span className="flex items-center gap-1">
                <span>👥</span>
                {o.minSubscribers.toLocaleString("fr-FR")} ab. min
              </span>
            )}
            {o.spots !== null && o.spots > 0 && (
              <span
                className={`flex items-center gap-1 ${urgent ? "font-bold text-red-600" : ""}`}
              >
                <span>{urgent ? "🔥" : "🎯"}</span>
                {o.spots} place{o.spots > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto pt-4">
          {status === "linked" ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <span>✓</span>
                Lien activé
              </p>
              <a
                href={`/r/${code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 block break-all rounded-md bg-white/80 px-2 py-1 font-mono text-[11px] text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-white"
              >
                collabbs.com/r/{code}
              </a>
              <p className="mt-2 text-[11px] font-medium text-emerald-700">
                <strong>{clicks}</strong> clic{clicks > 1 ? "s" : ""} ·{" "}
                <strong>{gains}€</strong> gagnés
              </p>
              <Link
                href={`/opportunities/${o.id}`}
                className="mt-2 inline-block text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                Voir les détails →
              </Link>
            </div>
          ) : status === "applied" ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <span>✓</span>
                Candidature envoyée
              </p>
              <p className="mt-1 text-[11px] text-emerald-700">
                Tu seras notifié·e quand la marque répond.
              </p>
              <Link
                href={`/opportunities/${o.id}`}
                className="mt-2 inline-block text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                Voir les détails →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {isAffiliation ? (
                <button
                  type="button"
                  onClick={onActivate}
                  disabled={busy}
                  className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Activation…" : "🔗 Activer en 1 clic"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onApply}
                  disabled={busy}
                  className="w-full rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Envoi…" : "Candidater"}
                </button>
              )}
              <Link
                href={`/opportunities/${o.id}`}
                className="block text-center text-[11px] font-semibold text-zinc-500 transition hover:text-ink"
              >
                Voir tous les détails →
              </Link>
            </div>
          )}
          {error && (
            <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
