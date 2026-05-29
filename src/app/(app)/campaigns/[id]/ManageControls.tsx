"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideApplication, setCampaignStatus } from "../actions";

export function ApplicationDecision({
  applicationId,
  initialStatus,
}: {
  applicationId: string;
  initialStatus: "pending" | "accepted" | "rejected" | "withdrawn";
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "accepted" | "rejected") {
    setBusy(true);
    setError(null);
    const res = await decideApplication(applicationId, decision);
    setBusy(false);
    if (res.ok) {
      setStatus(decision);
      router.refresh();
    } else setError(res.error ?? "Erreur.");
  }

  if (status === "accepted")
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        ✓ Acceptée
      </span>
    );
  if (status === "rejected")
    return (
      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500">
        Refusée
      </span>
    );
  if (status === "withdrawn")
    return (
      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500">
        Retirée
      </span>
    );

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={() => decide("rejected")}
        disabled={busy}
        className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-50"
      >
        Refuser
      </button>
      <button
        type="button"
        onClick={() => decide("accepted")}
        disabled={busy}
        className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "…" : "Accepter"}
      </button>
    </div>
  );
}

export function StatusToggle({
  campaignId,
  initialStatus,
}: {
  campaignId: string;
  initialStatus: "active" | "ended" | "draft";
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = status === "active" ? "ended" : "active";
    setBusy(true);
    const res = await setCampaignStatus(campaignId, next);
    setBusy(false);
    if (res.ok) {
      setStatus(next);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-50"
    >
      {busy ? "…" : status === "active" ? "Mettre en pause" : "Réactiver"}
    </button>
  );
}
