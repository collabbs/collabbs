"use client";

import { useState } from "react";

export default function ShareCampaignCard({
  publicUrl,
}: {
  publicUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="mt-8 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black text-ink">
            📣 Lien public à partager
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Cette URL ouvre une <strong>page publique</strong> de ta campagne — partage-la
            sur Twitter, Insta, ta newsletter ou en DM pour recruter des créateurs
            (même s&apos;ils ne sont pas encore sur Collabbs).
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-ink ring-1 ring-purple-100">
          {publicUrl}
        </code>
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 transition hover:bg-white"
        >
          Ouvrir
        </a>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
        >
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
    </section>
  );
}
