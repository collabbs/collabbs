"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { recordManualPromoSale } from "../actions";

export type PromoCreatorRow = {
  linkId: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string | null;
  promoCode: string;
  salesCount: number;
  salesAmount: number;
  commissionAmount: number;
};

/**
 * Panel marque sur /campaigns/[id] pour suivre & saisir les ventes attribuées
 * aux codes promo des créateurs. Affiche la liste des codes + leurs stats,
 * et propose un formulaire pour ajouter une vente à la main (utile quand la
 * marque n'a pas branché le postback /api/track/promo).
 */
export default function PromoTrackingPanel({
  campaignId,
  commissionPct,
  rows,
}: {
  campaignId: string;
  commissionPct: number | null;
  rows: PromoCreatorRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const num = Number(amount);
    if (!code.trim() || !Number.isFinite(num) || num <= 0) {
      toast.error("Code et montant requis.");
      return;
    }
    setBusy(true);
    const res = await recordManualPromoSale({
      campaignId,
      code: code.trim(),
      amount: num,
      orderRef: orderRef.trim() || null,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(
        `Vente enregistrée. Commission créateur : ${res.commission ?? 0}€.`,
      );
      setCode("");
      setAmount("");
      setOrderRef("");
      router.refresh();
    } else {
      toast.error(res.error ?? "Échec de l'enregistrement.");
    }
  }

  const totalSales = rows.reduce((s, r) => s + r.salesAmount, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commissionAmount, 0);
  const totalCount = rows.reduce((s, r) => s + r.salesCount, 0);

  return (
    <section className="mt-8 rounded-2xl border border-fuchsia-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black text-ink">
            🎟️ Tracking code promo
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Postback automatique disponible via{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">
              POST /api/track/promo
            </code>{" "}
            (cf panneau postback) — ou saisis tes ventes à la main ci-dessous.
          </p>
        </div>
        {commissionPct != null && commissionPct > 0 && (
          <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-bold text-fuchsia-800">
            Commission : {commissionPct}%
          </span>
        )}
      </div>

      {/* Stats globales */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-zinc-50 p-3 text-center">
          <p className="font-display text-xl font-black text-ink">{totalCount}</p>
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Ventes</p>
        </div>
        <div className="rounded-xl bg-zinc-50 p-3 text-center">
          <p className="font-display text-xl font-black text-ink">
            {totalSales.toLocaleString("fr-FR")}€
          </p>
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">CA total</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="font-display text-xl font-black text-emerald-700">
            {totalCommission.toLocaleString("fr-FR")}€
          </p>
          <p className="text-[11px] uppercase tracking-wide text-emerald-700">
            Commissions
          </p>
        </div>
      </div>

      {/* Saisie manuelle */}
      <form
        onSubmit={submit}
        className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/40 p-3"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Ajouter une vente à la main
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[140px_140px_1fr_auto]">
          <input
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))
            }
            placeholder="CODE"
            className="rounded-lg border border-zinc-300 px-2 py-2 text-sm font-mono outline-none focus:border-fuchsia-400"
          />
          <div className="flex items-center rounded-lg border border-zinc-300 px-2">
            <input
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))
              }
              inputMode="decimal"
              placeholder="49.99"
              className="w-full py-2 text-sm outline-none"
            />
            <span className="text-xs text-zinc-400">€</span>
          </div>
          <input
            value={orderRef}
            onChange={(e) => setOrderRef(e.target.value)}
            placeholder="N° commande (optionnel, évite les doublons)"
            className="rounded-lg border border-zinc-300 px-2 py-2 text-sm outline-none focus:border-fuchsia-400"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "+ Vente"}
          </button>
        </div>
      </form>

      {/* Détail par créateur */}
      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl bg-zinc-50 p-4 text-center text-xs text-zinc-500">
          Aucun créateur n&apos;a encore activé son code sur cette campagne.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-100">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">Créateur</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-right">Ventes</th>
                <th className="px-3 py-2 text-right">CA</th>
                <th className="px-3 py-2 text-right">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows
                .slice()
                .sort((a, b) => b.salesAmount - a.salesAmount)
                .map((r) => (
                  <tr key={r.linkId}>
                    <td className="px-3 py-2 font-medium text-ink">
                      {r.creatorName}
                      {r.creatorHandle && (
                        <span className="ml-1 text-xs text-zinc-400">
                          @{r.creatorHandle}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.promoCode}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.salesCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.salesAmount.toLocaleString("fr-FR")}€
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-700">
                      {r.commissionAmount.toLocaleString("fr-FR")}€
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
