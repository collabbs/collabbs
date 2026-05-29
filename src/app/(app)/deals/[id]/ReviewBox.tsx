"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leaveReview } from "../actions";

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-400" aria-label={`${value} sur 5`}>
      {"★".repeat(value)}
      <span className="text-zinc-200">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export default function ReviewBox({
  dealId,
  role,
  status,
  existingReview,
}: {
  dealId: string;
  role: "brand" | "creator";
  status: "negotiation" | "active" | "completed" | "cancelled";
  existingReview: { rating: number; comment: string | null } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "completed") return null;

  if (existingReview) {
    return (
      <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-black text-ink">Avis</h2>
        <div className="mt-2 flex items-center gap-2">
          <Stars value={existingReview.rating} />
          <span className="text-sm font-semibold text-ink">{existingReview.rating}/5</span>
        </div>
        {existingReview.comment && (
          <p className="mt-2 text-sm text-zinc-600">« {existingReview.comment} »</p>
        )}
      </div>
    );
  }

  if (role !== "brand") {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-5 text-sm text-zinc-500">
        En attente de l&apos;avis de la marque sur cette collaboration.
      </div>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await leaveReview(dealId, rating, comment);
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error ?? "Erreur.");
  }

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-black text-ink">Laisser un avis</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Ton avis apparaîtra sur le profil public du créateur.
      </p>
      <div className="mt-3 flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className={`text-2xl transition ${
              n <= (hover || rating) ? "text-amber-400" : "text-zinc-200"
            }`}
            aria-label={`Noter ${n} sur 5`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Comment s'est passée la collaboration ?"
        className="mt-3 w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Envoi…" : "Publier l'avis"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
