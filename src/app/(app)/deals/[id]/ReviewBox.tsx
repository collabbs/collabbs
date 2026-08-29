"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leaveReview, leaveBrandReview } from "../actions";

/**
 * Avis de fin de collaboration — dans les deux sens.
 *
 * La marque note le créateur, le créateur note la marque. Chacun voit l'avis
 * qu'il a reçu et peut laisser le sien. La symétrie compte : un créateur qui
 * ne peut pas signaler une marque qui paie mal n'a aucun moyen de protéger
 * les suivants.
 */

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-400" aria-label={`${value} sur 5`}>
      {"★".repeat(value)}
      <span className="text-zinc-200">{"★".repeat(5 - value)}</span>
    </span>
  );
}

type Review = { rating: number; comment: string | null } | null;

function Received({ review, from }: { review: Review; from: string }) {
  if (!review) return null;
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-black text-ink">Avis reçu</h2>
      <p className="mt-0.5 text-xs text-zinc-500">De la part {from}</p>
      <div className="mt-2 flex items-center gap-2">
        <Stars value={review.rating} />
        <span className="text-sm font-semibold text-ink">{review.rating}/5</span>
      </div>
      {review.comment && (
        <p className="mt-2 text-sm text-zinc-600">« {review.comment} »</p>
      )}
    </div>
  );
}

export default function ReviewBox({
  dealId,
  role,
  status,
  existingReview,
  existingBrandReview,
}: {
  dealId: string;
  role: "brand" | "creator";
  status: "negotiation" | "active" | "completed" | "cancelled";
  /** Avis de la marque sur le créateur. */
  existingReview: Review;
  /** Avis du créateur sur la marque. */
  existingBrandReview?: Review;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "completed") return null;

  const isBrand = role === "brand";
  // Ce que j'ai reçu de l'autre partie, et ce que j'ai moi-même laissé.
  const received = isBrand ? existingBrandReview ?? null : existingReview;
  const mine = isBrand ? existingReview : existingBrandReview ?? null;

  async function submit() {
    setBusy(true);
    setError(null);
    const res = isBrand
      ? await leaveReview(dealId, rating, comment)
      : await leaveBrandReview(dealId, rating, comment);
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error ?? "Erreur.");
  }

  return (
    <div className="flex flex-col gap-3">
      <Received review={received} from={isBrand ? "du créateur" : "de la marque"} />

      {mine ? (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">Ton avis</h2>
          <div className="mt-2 flex items-center gap-2">
            <Stars value={mine.rating} />
            <span className="text-sm font-semibold text-ink">{mine.rating}/5</span>
          </div>
          {mine.comment && (
            <p className="mt-2 text-sm text-zinc-600">« {mine.comment} »</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">Laisser un avis</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {isBrand
              ? "Ton avis apparaîtra sur le profil public du créateur."
              : "Ton avis apparaîtra sur le profil public de la marque — il aidera les créateurs suivants à savoir à qui ils ont affaire."}
          </p>
          <div className="mt-3 flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(n)}
                aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                className={`text-2xl transition ${
                  n <= (hover || rating) ? "text-amber-400" : "text-zinc-200"
                }`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={
              isBrand
                ? "Comment s'est passée la collaboration ?"
                : "Paiement, délais de validation, qualité des échanges…"
            }
            className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Envoi…" : "Publier mon avis"}
          </button>
        </div>
      )}
    </div>
  );
}
