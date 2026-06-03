"use client";

import { useState } from "react";

type CampaignType = "affiliation" | "video" | "performance" | "hybrid";

/**
 * Calculatrice de gains — UN composant pour les 4 types de campagne.
 * Affiliation : tier-based commission % × ventes × panier
 * Performance : commission_value€ pour 1 000 vues
 * Hybrid : fixed_amount + tier-based commission
 * Video (fixed) : juste fixed_amount × quantité (peu utile en simulateur)
 */
export default function EarningsCalculator({
  type,
  fixedAmount = null,
  commissionValue = null,
  tierPcts,
  avgBasket = 50,
}: {
  type: CampaignType;
  fixedAmount?: number | null;
  commissionValue?: number | null;
  tierPcts: { nano: number | null; micro: number | null; mid: number | null; macro: number | null };
  avgBasket?: number;
}) {
  // ===== Affiliation / Hybrid =====
  const [sales, setSales] = useState(10);
  const [basket, setBasket] = useState(avgBasket);
  // ===== Performance =====
  const [views, setViews] = useState(50000);
  // ===== Video fixed =====
  const [contentCount, setContentCount] = useState(1);

  const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")}€`;

  const ca = sales * basket;

  // ===== Render selon le type =====

  if (type === "video") {
    const total = (fixedAmount ?? 0) * contentCount;
    return (
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-black text-ink">
          💸 Combien tu peux gagner
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Forfait fixe — pas de dépendance aux ventes.
        </p>
        <div className="mt-5">
          <label className="flex justify-between text-xs font-semibold text-zinc-700">
            <span>Nombre de contenus livrés</span>
            <span className="text-brand">{contentCount}</span>
          </label>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={contentCount}
            onChange={(e) => setContentCount(Number(e.target.value))}
            className="mt-2 w-full accent-purple-600"
          />
        </div>
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-5 text-center shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Tu gagnes
          </p>
          <p className="mt-1 font-display text-4xl font-black tracking-tight text-emerald-700">
            {eur(total)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {contentCount} × {fixedAmount}€ par contenu
          </p>
        </div>
      </section>
    );
  }

  if (type === "performance") {
    const totalGain = ((commissionValue ?? 0) * views) / 1000;
    return (
      <section className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/60 to-orange-50/40 p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-black text-ink">
          📊 Combien tu peux gagner
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Payé selon les vues réelles confirmées par la marque.
        </p>
        <div className="mt-5">
          <label className="flex justify-between text-xs font-semibold text-zinc-700">
            <span>Vues estimées</span>
            <span className="text-brand">{views.toLocaleString("fr-FR")}</span>
          </label>
          <input
            type="range"
            min={1000}
            max={1000000}
            step={1000}
            value={views}
            onChange={(e) => setViews(Number(e.target.value))}
            className="mt-2 w-full accent-purple-600"
          />
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>1k</span>
            <span>1M</span>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-white p-5 text-center shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Tu gagnes
          </p>
          <p className="mt-1 font-display text-4xl font-black tracking-tight text-amber-700">
            {eur(totalGain)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {(views / 1000).toLocaleString("fr-FR")} × {commissionValue}€ / 1 000 vues
          </p>
        </div>
      </section>
    );
  }

  // ===== Affiliation ou Hybrid =====

  const earnByTier = {
    nano: tierPcts.nano != null ? (ca * tierPcts.nano) / 100 : null,
    micro: tierPcts.micro != null ? (ca * tierPcts.micro) / 100 : null,
    mid: tierPcts.mid != null ? (ca * tierPcts.mid) / 100 : null,
    macro: tierPcts.macro != null ? (ca * tierPcts.macro) / 100 : null,
  };

  const fixedBonus = type === "hybrid" ? (fixedAmount ?? 0) : 0;

  const tiers = [
    { key: "nano" as const, label: "Nano", subs: "< 10k", color: "from-zinc-50 to-zinc-100" },
    { key: "micro" as const, label: "Micro", subs: "10k-100k", color: "from-purple-50 to-purple-100/60" },
    { key: "mid" as const, label: "Mid", subs: "100k-1M", color: "from-pink-50 to-pink-100/60" },
    { key: "macro" as const, label: "Macro", subs: "> 1M", color: "from-emerald-50 to-emerald-100/60" },
  ];

  return (
    <section className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-purple-50/30 to-pink-50/30 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-black text-ink">
          💰 Combien tu peux gagner
        </h2>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          {type === "hybrid" ? "Fixe + commission" : "Affiliation"}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Joue avec les curseurs pour estimer ton revenu mensuel selon ton
        audience.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="flex justify-between text-xs font-semibold text-zinc-700">
            <span>Ventes mensuelles estimées</span>
            <span className="text-brand">{sales}</span>
          </label>
          <input
            type="range"
            min={1}
            max={200}
            step={1}
            value={sales}
            onChange={(e) => setSales(Number(e.target.value))}
            className="mt-2 w-full accent-purple-600"
          />
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>1</span>
            <span>200</span>
          </div>
        </div>
        <div>
          <label className="flex justify-between text-xs font-semibold text-zinc-700">
            <span>Panier moyen</span>
            <span className="text-brand">{basket}€</span>
          </label>
          <input
            type="range"
            min={10}
            max={500}
            step={5}
            value={basket}
            onChange={(e) => setBasket(Number(e.target.value))}
            className="mt-2 w-full accent-purple-600"
          />
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>10€</span>
            <span>500€</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiers.map((t) => {
          const gain = (earnByTier[t.key] ?? 0) + fixedBonus;
          const pct = tierPcts[t.key];
          const disabled = pct === null;
          return (
            <div
              key={t.key}
              className={`rounded-xl border bg-gradient-to-br ${t.color} p-3 text-center transition ${
                disabled
                  ? "border-zinc-100 opacity-40"
                  : "border-zinc-200 shadow-sm"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                {t.label}
              </p>
              <p className="text-[9px] text-zinc-400">{t.subs}</p>
              <p className="mt-2 font-display text-2xl font-black text-emerald-700">
                {disabled ? "—" : eur(gain)}
              </p>
              <p className="text-[10px] text-zinc-500">
                {disabled ? "non défini" : type === "hybrid" ? `${fixedAmount}€ + ${pct}%` : `${pct}% comm.`}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] italic text-zinc-500">
        Estimation à titre indicatif. CA mensuel : {eur(ca)} (
        {sales} × {basket}€){type === "hybrid" && fixedAmount ? ` + ${fixedAmount}€ fixe par contenu` : ""}.
      </p>
    </section>
  );
}
