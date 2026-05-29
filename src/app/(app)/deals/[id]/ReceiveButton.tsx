"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { releaseDealPayout } from "../actions";

export default function ReceiveButton({
  dealId,
  amountLabel,
}: {
  dealId: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await releaseDealPayout(dealId);
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error ?? "Erreur.");
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="block w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Versement en cours…" : `Recevoir ${amountLabel}`}
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-red-600">
          {error}{" "}
          {error.toLowerCase().includes("connect") && (
            <Link href="/payouts" className="underline">
              Connecter mon compte
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
