"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { refundDeal } from "../actions";

export default function RefundButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doRefund() {
    setBusy(true);
    setError(null);
    const res = await refundDeal(dealId);
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error ?? "Erreur.");
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-2 w-full rounded-full px-4 py-2 text-xs font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
      >
        Récupérer mes fonds
      </button>
    );
  }

  return (
    <div className="mt-2">
      {/* ⚠️ Écrit pour CELLE QUI LIT. « Rembourser l'intégralité à la marque ? »
          était rédigé du point de vue d'un arbitre — alors que ce panneau ne
          s'affiche qu'à la marque elle-même, qui se demandait à qui on parlait.
          Et la phrase disait ce qu'on fait sans dire ce qui en découle : la
          collaboration prend fin, et le créateur l'apprend. Ça se dit AVANT le
          clic, pas après. */}
      <p className="text-xs leading-relaxed text-zinc-500">
        L&apos;intégralité du séquestre te sera rendue. La collaboration prendra
        fin et le créateur en sera informé.
      </p>
      <div className="mt-1.5 flex gap-2">
        <button
          type="button"
          onClick={doRefund}
          disabled={busy}
          className="flex-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? "…" : "Oui, rembourser"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
        >
          Annuler
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
