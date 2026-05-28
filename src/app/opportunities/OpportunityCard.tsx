"use client";

import { useState } from "react";
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

const TYPE_LABEL: Record<Opportunity["type"], string> = {
  affiliation: "Affiliation",
  video: "Paiement fixe",
  performance: "Performance",
  hybrid: "Hybride",
};

function reward(o: Opportunity): string {
  switch (o.type) {
    case "affiliation":
      return `Commission ${o.tiers.nano ?? "?"}%–${o.tiers.macro ?? "?"}%`;
    case "video":
      return o.fixedAmount ? `${o.fixedAmount}€ par contenu` : "Paiement fixe";
    case "performance":
      return o.commissionValue
        ? `${o.commissionValue}€ / 1000 vues`
        : "À la performance";
    case "hybrid":
      return `${o.fixedAmount ?? 0}€ + commission ${o.tiers.nano ?? "?"}–${o.tiers.macro ?? "?"}%`;
  }
}

export default function OpportunityCard({
  opportunity,
  initialStatus,
  initialCode,
}: {
  opportunity: Opportunity;
  initialStatus: "none" | "linked" | "applied";
  initialCode?: string;
}) {
  const o = opportunity;
  const isAffiliation = o.type === "affiliation" || o.type === "hybrid";
  const [status, setStatus] = useState(initialStatus);
  const [code, setCode] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="flex h-full flex-col rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-xs font-bold text-zinc-500 ring-1 ring-zinc-100">
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
          <div>
            <p className="text-xs font-medium text-zinc-400">{o.brandName}</p>
            <h3 className="font-semibold text-ink">{o.name}</h3>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-brand-deep">
          {TYPE_LABEL[o.type]}
        </span>
      </div>

      {o.description && (
        <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{o.description}</p>
      )}

      <p className="mt-3 text-sm font-bold text-ink">{reward(o)}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {o.platforms.map((p) => (
          <span
            key={p.slug}
            className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600"
          >
            <PlatformIcon slug={p.slug} className="h-3 w-3" />
            {p.label}
          </span>
        ))}
        {o.niches.map((n) => (
          <span
            key={n}
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600"
          >
            {n}
          </span>
        ))}
      </div>

      {(o.minSubscribers || o.spots) && (
        <p className="mt-2 text-xs text-zinc-400">
          {o.minSubscribers ? `${o.minSubscribers.toLocaleString("fr-FR")} abonnés min.` : ""}
          {o.minSubscribers && o.spots ? " · " : ""}
          {o.spots ? `${o.spots} places` : ""}
        </p>
      )}

      <div className="mt-auto pt-4">
        {status === "linked" ? (
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-700">
              ✓ Lien d&apos;affiliation activé
            </p>
            <p className="mt-1 break-all font-mono text-xs text-zinc-600">
              collabbs.com/r/{code}
            </p>
          </div>
        ) : status === "applied" ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
            ✓ Candidature envoyée
          </p>
        ) : isAffiliation ? (
          <button
            type="button"
            onClick={onActivate}
            disabled={busy}
            className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Activation…" : "🔗 Activer mon lien en 1 clic"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onApply}
            disabled={busy}
            className="w-full rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Envoi…" : "Candidater"}
          </button>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
