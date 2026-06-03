"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { requestRevision } from "../actions";

/**
 * Panneau client pour demander une retouche sur un livrable.
 * Visible côté marque, sur un livrable déjà soumis non-validé,
 * tant que le quota de retouches n'est pas épuisé.
 */
export default function RevisionPanel({
  deliverableId,
  deliverableLabel,
  remaining,
  max,
}: {
  deliverableId: string;
  deliverableLabel: string;
  remaining: number;
  max: number;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (remaining <= 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
        <p className="font-bold text-amber-800">
          Quota retouches atteint ({max}/{max})
        </p>
        <p className="mt-1 text-amber-700">
          Tu as utilisé toutes les retouches incluses dans ce forfait. Tu peux
          valider la version actuelle ou en discuter avec le créateur sur la
          messagerie pour un nouveau deal.
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || message.trim().length < 5) return;
    setBusy(true);
    const res = await requestRevision(deliverableId, message);
    setBusy(false);
    if (res.ok) {
      toast.success("Demande de retouche envoyée.");
      setMessage("");
      setOpen(false);
    } else {
      toast.error(res.error ?? "Échec de la demande.");
    }
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-50"
        >
          ↺ Demander des retouches
          <span className="ml-1 text-amber-600">
            ({remaining}/{max} restant{remaining > 1 ? "s" : ""})
          </span>
        </button>
      ) : (
        <form onSubmit={onSubmit} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <label
            htmlFor={`revmsg-${deliverableId}`}
            className="block text-xs font-bold text-amber-800"
          >
            Que doit ajuster le créateur sur « {deliverableLabel} » ?
          </label>
          <textarea
            id={`revmsg-${deliverableId}`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Ex : Le hook démarre trop tard, on perd l'attention. Repars sur les 2 premières secondes en montrant directement le produit."
            className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400"
          />
          <p className="mt-1 text-[11px] text-amber-700">
            ⚠️ Cette demande consomme 1 round sur {remaining} restant
            {remaining > 1 ? "s" : ""}.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={busy || message.trim().length < 5}
              className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? "Envoi…" : "Envoyer la demande"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setMessage("");
              }}
              className="rounded-full px-4 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
