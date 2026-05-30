"use client";

import { useState } from "react";

export default function PostbackPanel({
  origin,
  secret,
}: {
  origin: string;
  secret: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"secret" | "url" | "snippet" | null>(null);
  const [showSnippet, setShowSnippet] = useState(false);

  const endpoint = `${origin}/api/track/sale`;
  const masked = "•".repeat(Math.max(8, Math.min(48, secret.length)));

  const snippet = `// 1) Sur votre site, capter ?ref dans l'URL et le stocker en cookie 30 jours
const ref = new URLSearchParams(location.search).get("ref");
if (ref) document.cookie = "collabbs_ref=" + ref + "; max-age=2592000; path=/";

// 2) À la confirmation de commande, depuis VOTRE SERVEUR (pas le navigateur !)
//    Exemple Node :
await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + process.env.COLLABBS_POSTBACK_SECRET,
  },
  body: JSON.stringify({
    code: "<ref capté depuis votre cookie>",
    amount: 49.99,
    order_id: "ORD-12345",
  }),
});`;

  function copy(label: "secret" | "url" | "snippet", text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black text-ink">
            🔗 Tracking des ventes
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Connecte ta boutique pour que chaque vente attribuée à un créateur déclenche
            automatiquement sa commission.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          Sécurisé
        </span>
      </div>

      <dl className="mt-5 space-y-4">
        {/* Endpoint */}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Endpoint
          </dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs text-ink ring-1 ring-zinc-100">
              POST {endpoint}
            </code>
            <button
              type="button"
              onClick={() => copy("url", endpoint)}
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
            >
              {copied === "url" ? "Copié ✓" : "Copier"}
            </button>
          </dd>
        </div>

        {/* Secret */}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Clé secrète marque
          </dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs text-ink ring-1 ring-zinc-100">
              {revealed ? secret : masked}
            </code>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
            >
              {revealed ? "Cacher" : "Révéler"}
            </button>
            <button
              type="button"
              onClick={() => copy("secret", secret)}
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
            >
              {copied === "secret" ? "Copié ✓" : "Copier"}
            </button>
          </dd>
          <p className="mt-1.5 text-xs text-zinc-400">
            ⚠️ À garder sur ton serveur uniquement, jamais dans le navigateur.
          </p>
        </div>
      </dl>

      {/* Comment ça marche */}
      <div className="mt-5 rounded-xl bg-zinc-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          En 3 étapes
        </p>
        <ol className="mt-2 space-y-1.5 text-sm text-zinc-600">
          <li>
            <strong className="text-ink">1.</strong> Au clic depuis Collabbs, on ajoute
            <code className="mx-1 rounded bg-white px-1 py-0.5 font-mono text-[11px] ring-1 ring-zinc-100">?ref=…</code>
            à ton URL → capte-le côté boutique et stocke-le en cookie 30 jours.
          </li>
          <li>
            <strong className="text-ink">2.</strong> À la confirmation de commande, depuis
            <strong> ton serveur</strong>, envoie un <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px] ring-1 ring-zinc-100">POST</code> à l&apos;endpoint avec ta clé en
            <code className="ml-1 rounded bg-white px-1 py-0.5 font-mono text-[11px] ring-1 ring-zinc-100">Authorization: Bearer …</code>.
          </li>
          <li>
            <strong className="text-ink">3.</strong> La commission du créateur est calculée
            (selon son palier d&apos;audience) et créditée automatiquement.
          </li>
        </ol>
      </div>

      {/* Snippet */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowSnippet((v) => !v)}
          className="text-xs font-semibold text-brand hover:underline"
        >
          {showSnippet ? "Masquer" : "Voir"} le code à coller
        </button>
        {showSnippet && (
          <div className="mt-2 overflow-hidden rounded-xl border border-zinc-100">
            <div className="flex items-center justify-between bg-zinc-50 px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Exemple JavaScript / Node
              </span>
              <button
                type="button"
                onClick={() => copy("snippet", snippet)}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-white"
              >
                {copied === "snippet" ? "Copié ✓" : "Copier"}
              </button>
            </div>
            <pre className="overflow-x-auto bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100">
              <code>{snippet}</code>
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
