"use client";

import { useState } from "react";
import Link from "next/link";
import PlatformIcon from "@/components/PlatformIcon";
import { activateAffiliateLink, applyToCampaign } from "./actions";

export type Opportunity = {
  id: string;
  name: string;
  description: string | null;
  type: "affiliation" | "video" | "hybrid" | "performance";
  fixedAmount: number | null;
  commissionValue: number | null;
  tiers: { nano: number | null; macro: number | null };
  minSubscribers: number | null;
  spots: number | null;
  brandName: string;
  brandLogo: string | null;
  niches: string[];
  platforms: { label: string; slug: string }[];
};

const TYPE_META: Record<
  Opportunity["type"],
  { label: string; emoji: string; tone: string; band: string }
> = {
  affiliation: {
    label: "Affiliation",
    emoji: "🔗",
    tone: "bg-emerald-50 text-emerald-700",
    band: "from-emerald-400 to-teal-500",
  },
  video: {
    label: "Paiement fixe",
    emoji: "🎬",
    tone: "bg-purple-50 text-purple-700",
    band: "from-purple-500 to-pink-500",
  },
  performance: {
    label: "Performance",
    emoji: "📊",
    tone: "bg-amber-50 text-amber-700",
    band: "from-amber-400 to-orange-500",
  },
  hybrid: {
    label: "Hybride",
    emoji: "💎",
    tone: "bg-cyan-50 text-cyan-700",
    band: "from-cyan-400 via-purple-500 to-pink-500",
  },
};

/**
 * Décompose la rémunération en "valeur principale" + "qualifieur".
 * Permet d'afficher le chiffre vraiment grand et la suite plus discrète.
 */
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
        sub: `+ ${o.tiers.nano ?? "?"}–${o.tiers.macro ?? "?"}% commission`,
      };
  }
}

/** Vérifie si l'opportunité mérite un badge "premium" (rémunération forte). */
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
  const premium = isPremium(o);
  const urgent = o.spots !== null && o.spots <= 3 && o.spots > 0;

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
      {/* Bande de couleur par type */}
      <div className={`h-1 bg-gradient-to-r ${meta.band}`} />

      <div className="flex flex-1 flex-col p-5">
        {/* Header : brand + badges contextuels */}
        <div className="flex items-start justify-between gap-3">
          <Link href={`/opportunities/${o.id}`} className="flex items-center gap-2.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 text-xs font-bold text-zinc-500 ring-1 ring-white">
              {o.brandLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={o.brandLogo}
                  alt={o.brandName}
                  className="h-full w-full object-contain p-1.5"
                />
              ) : (
                o.brandName.slice(0, 2).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                {o.brandName}
              </p>
              <h3 className="truncate font-display text-base font-black text-ink transition group-hover:text-brand">
                {o.name}
              </h3>
            </div>
          </Link>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.tone}`}>
              <span>{meta.emoji}</span>
              {meta.label}
            </span>
            {premium && (
              <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                ★ Premium
              </span>
            )}
          </div>
        </div>

        {/* Reward XL */}
        <div className="mt-4 rounded-xl border border-zinc-100 bg-gradient-to-br from-zinc-50 to-zinc-100/40 p-3">
          <p className="font-display text-2xl font-black tracking-tight text-ink">
            {reward.main}
          </p>
          <p className="text-xs text-zinc-500">{reward.sub}</p>
        </div>

        {/* Description */}
        {o.description && (
          <p className="mt-3 line-clamp-2 text-sm text-zinc-600">{o.description}</p>
        )}

        {/* Plateformes + niches */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {o.platforms.slice(0, 4).map((p) => (
            <span
              key={p.slug}
              className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200"
            >
              <PlatformIcon slug={p.slug} className="h-3 w-3" />
              {p.label}
            </span>
          ))}
          {o.niches.slice(0, 3).map((n) => (
            <span
              key={n}
              className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-brand-deep"
            >
              {n}
            </span>
          ))}
        </div>

        {/* Méta : abonnés min + places */}
        {(o.minSubscribers || o.spots) && (
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
                {urgent ? " restantes !" : ""}
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
            </div>
          ) : isAffiliation ? (
            <button
              type="button"
              onClick={onActivate}
              disabled={busy}
              className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Activation…" : "🔗 Activer mon lien en 1 clic"}
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
          {error && (
            <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
