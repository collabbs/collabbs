"use client";

import { useState } from "react";
import { activateAffiliateLink, applyToCampaign } from "../actions";

export default function ActionPanel({
  campaignId,
  isAffiliation,
  initialStatus,
  initialCode,
  clicks = 0,
  gains = 0,
}: {
  campaignId: string;
  isAffiliation: boolean;
  initialStatus: "none" | "linked" | "applied";
  initialCode?: string;
  clicks?: number;
  gains?: number;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [code, setCode] = useState(initialCode ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onActivate() {
    setBusy(true);
    setError(null);
    const res = await activateAffiliateLink(campaignId);
    setBusy(false);
    if (res.ok && res.code) {
      setCode(res.code);
      setStatus("linked");
    } else setError(res.error ?? "Erreur.");
  }

  async function onApply() {
    setBusy(true);
    setError(null);
    const res = await applyToCampaign(campaignId, message);
    setBusy(false);
    if (res.ok) setStatus("applied");
    else setError(res.error ?? "Erreur.");
  }

  function copyLink() {
    navigator.clipboard?.writeText(`https://collabbs.com/r/${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (status === "linked") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-bold text-emerald-700">
          ✓ Ton lien d&apos;affiliation est actif
        </p>
        <p className="mt-1 text-xs text-emerald-600">
          Partage-le partout : chaque vente générée te rapporte une commission.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-brand ring-1 ring-emerald-200">
            collabbs.com/r/{code}
          </code>
          <button
            type="button"
            onClick={copyLink}
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            {copied ? "Copié ✓" : "Copier"}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-emerald-200 pt-4 text-center">
          <div>
            <p className="text-xl font-extrabold text-emerald-700">{clicks}</p>
            <p className="text-[11px] text-emerald-600">Clics</p>
          </div>
          <div>
            <p className="text-xl font-extrabold text-emerald-700">{gains}€</p>
            <p className="text-[11px] text-emerald-600">Gains</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "applied") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-bold text-emerald-700">✓ Candidature envoyée</p>
        <p className="mt-1 text-xs text-emerald-600">
          La marque va étudier ton profil. Tu seras notifié·e de sa réponse.
        </p>
      </div>
    );
  }

  if (isAffiliation) {
    return (
      <div>
        <button
          type="button"
          onClick={onActivate}
          disabled={busy}
          className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Activation…" : "🔗 Activer mon lien en 1 clic"}
        </button>
        <p className="mt-2 text-center text-xs text-zinc-500">
          Aucune validation requise — ton lien est généré instantanément.
        </p>
        {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-semibold text-zinc-500" htmlFor="apply-msg">
        Message à la marque (optionnel)
      </label>
      <textarea
        id="apply-msg"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Présente-toi en quelques mots : pourquoi cette collab te parle, tes idées de contenu…"
        className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
      />
      <button
        type="button"
        onClick={onApply}
        disabled={busy}
        className="mt-3 w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Envoi…" : "Candidater à cette campagne"}
      </button>
      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
