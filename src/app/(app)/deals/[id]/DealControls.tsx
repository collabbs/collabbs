"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  acceptDeal,
  cancelDeal,
  completeDeal,
  updateDealTerms,
} from "../actions";
import DeliverableRow, { type Deliverable } from "./DeliverableRow";

type Props = {
  dealId: string;
  role: "brand" | "creator";
  status: "negotiation" | "active" | "completed" | "cancelled";
  deliverables: Deliverable[];
  terms: { amount: number; quantity: number; deadline: string | null; brandNotes: string | null };
};

export default function DealControls({ dealId, role, status, deliverables, terms }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(terms.amount);
  const [quantity, setQuantity] = useState(terms.quantity);
  const [deadline, setDeadline] = useState(terms.deadline ?? "");
  const [notes, setNotes] = useState(terms.brandNotes ?? "");

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error ?? "Erreur.");
  }

  const allApproved =
    deliverables.length > 0 && deliverables.every((d) => d.approved);

  return (
    <div className="space-y-5">
      {/* Livrables */}
      {(status === "active" || status === "completed") && deliverables.length > 0 && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">Livrables</h2>
          <ul className="mt-3 space-y-2.5">
            {deliverables.map((d) => (
              <DeliverableRow
                key={d.id}
                d={d}
                dealId={dealId}
                role={role}
                status={status}
                busy={busy}
                onAction={run}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Édition des termes (marque, négociation) */}
      {role === "brand" && status === "negotiation" && editing && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">Ajuster les termes</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-xs font-semibold text-zinc-500">Montant (€)</span>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold text-zinc-500">Quantité de contenus</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-xs font-semibold text-zinc-500">Échéance</span>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-xs font-semibold text-zinc-500">Brief / notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const res = await updateDealTerms(dealId, {
                    amount,
                    quantity,
                    deadline: deadline || null,
                    brandNotes: notes,
                  });
                  if (res.ok) setEditing(false);
                  return res;
                })
              }
              className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full px-5 py-2 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Barre d'actions */}
      {status !== "completed" && status !== "cancelled" && (
        <div className="flex flex-wrap items-center gap-2">
          {role === "creator" && status === "negotiation" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => acceptDeal(dealId))}
                className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Accepter le deal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => cancelDeal(dealId))}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Refuser
              </button>
            </>
          )}

          {role === "brand" && status === "negotiation" && (
            <>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {editing ? "Fermer l'édition" : "Modifier les termes"}
              </button>
              <span className="text-xs text-zinc-400">En attente de l&apos;acceptation du créateur</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => cancelDeal(dealId))}
                className="ml-auto rounded-full px-4 py-2 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Annuler le deal
              </button>
            </>
          )}

          {role === "brand" && status === "active" && (
            <>
              <button
                type="button"
                disabled={busy || !allApproved}
                title={!allApproved ? "Valide tous les livrables d'abord" : undefined}
                onClick={() => run(() => completeDeal(dealId))}
                className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Clôturer le deal
              </button>
              {!allApproved && (
                <span className="text-xs text-zinc-400">Valide tous les livrables pour clôturer</span>
              )}
            </>
          )}

          {role === "creator" && status === "active" && (
            <span className="text-sm text-zinc-500">
              Marque tes livrables comme livrés ci-dessus — la marque valide puis clôture.
            </span>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
