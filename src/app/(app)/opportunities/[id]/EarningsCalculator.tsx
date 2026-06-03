"use client";

import { useState } from "react";

/**
 * Calculatrice de gains pour les campagnes d'affiliation.
 * Le créateur joue avec un slider (nb de ventes mensuelles estimées)
 * et voit son revenu estimé selon les tiers d'audience renseignés par
 * la marque (nano / micro / mid / macro).
 */
export default function EarningsCalculator({
  tierPcts,
  avgBasket = 50,
}: {
  tierPcts: { nano: number | null; micro: number | null; mid: number | null; macro: number | null };
  /** Panier moyen estimé en €. Par défaut 50€. */
  avgBasket?: number;
}) {
  const [sales, setSales] = useState(10);
  const [basket, setBasket] = useState(avgBasket);

  const ca = sales * basket;
  const earnByTier = {
    nano: tierPcts.nano != null ? (ca * tierPcts.nano) / 100 : null,
    micro: tierPcts.micro != null ? (ca * tierPcts.micro) / 100 : null,
    mid: tierPcts.mid != null ? (ca * tierPcts.mid) / 100 : null,
    macro: tierPcts.macro != null ? (ca * tierPcts.macro) / 100 : null,
  };
  const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")}€`;

  const tiers = [
    { key: "nano" as const, label: "Nano", subs: "< 10k" },
    { key: "micro" as const, label: "Micro", subs: "10k-100k" },
    { key: "mid" as const, label: "Mid", subs: "100k-1M" },
    { key: "macro" as const, label: "Macro", subs: "> 1M" },
  ];

  return (
    <section className="rounded-2xl border border-zinc-100 bg-gradient-to-br from-purple-50/40 to-pink-50/30 p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-black text-ink">
        🧮 Combien tu peux gagner
      </h2>
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
          const gain = earnByTier[t.key];
          const pct = tierPcts[t.key];
          const disabled = pct === null;
          return (
            <div
              key={t.key}
              className={`rounded-xl border bg-white p-3 text-center transition ${
                disabled
                  ? "border-zinc-100 opacity-40"
                  : "border-purple-100 shadow-sm"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                {t.label}
              </p>
              <p className="text-[9px] text-zinc-400">{t.subs}</p>
              <p className="mt-2 font-display text-xl font-black text-ink">
                {disabled ? "—" : eur(gain ?? 0)}
              </p>
              <p className="text-[10px] text-zinc-500">
                {disabled ? "non défini" : `${pct}% comm.`}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] italic text-zinc-500">
        Estimation à titre indicatif. CA mensuel : {eur(ca)} (
        {sales} × {basket}€).
      </p>
    </section>
  );
}
