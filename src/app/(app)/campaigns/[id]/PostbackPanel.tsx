"use client";

import { useState } from "react";
import Link from "next/link";

type Mode = "drop" | "server";

export default function PostbackPanel({
  origin,
  brandId,
  secret,
  website,
}: {
  origin: string;
  brandId: string;
  secret: string;
  website: string | null;
}) {
  const [mode, setMode] = useState<Mode>("drop");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const scriptSrc = `${origin}/track.js`;
  const endpoint = `${origin}/api/track/sale`;
  const masked = "•".repeat(Math.max(8, Math.min(48, secret.length)));

  const dropHead = `<script src="${scriptSrc}" data-brand="${brandId}"></script>`;
  const dropThanks = `<script>Collabbs.trackSale(MONTANT_TOTAL, "ORDER_ID_UNIQUE");</script>`;

  const serverSnippet = `// 1) Sur votre site, capter ?ref dans l'URL et le stocker en cookie 30 jours
const ref = new URLSearchParams(location.search).get("ref");
if (ref) document.cookie = "collabbs_ref=" + ref + "; max-age=2592000; path=/";

// 2) À la confirmation de commande, depuis VOTRE SERVEUR (pas le navigateur)
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

  function copy(label: string, text: string) {
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

      {/* Tabs */}
      <div className="mt-5 flex gap-2 border-b border-zinc-100">
        <button
          type="button"
          onClick={() => setMode("drop")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
            mode === "drop"
              ? "border-brand text-ink"
              : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          ⚡ Rapide (2 balises)
        </button>
        <button
          type="button"
          onClick={() => setMode("server")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
            mode === "server"
              ? "border-brand text-ink"
              : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          🔒 Sécurisé (serveur)
        </button>
      </div>

      {/* === MODE DROP-IN ============================================ */}
      {mode === "drop" && (
        <div className="mt-5">
          <p className="text-sm text-zinc-600">
            Colle 2 balises sur ton site, c&apos;est tout. Le script gère le cookie, le ref, et
            le pixel de vente.
          </p>

          {!website && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              ⚠️ Pour que ce mode marche, tu dois <strong>enregistrer le site web</strong> de ta
              marque (on vérifie l&apos;origine des appels). Va sur{" "}
              <Link href="/onboarding/brand" className="underline">
                Mon profil
              </Link>{" "}
              pour le faire.
            </div>
          )}

          {/* Étape 1 */}
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              1. Dans le <code className="rounded bg-zinc-100 px-1 font-mono text-[11px]">&lt;head&gt;</code> de toutes tes pages
            </p>
            <div className="mt-1.5 overflow-hidden rounded-xl border border-zinc-100">
              <pre className="overflow-x-auto bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100">
                <code>{dropHead}</code>
              </pre>
              <div className="flex items-center justify-end bg-zinc-50 px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => copy("drop-head", dropHead)}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-white"
                >
                  {copied === "drop-head" ? "Copié ✓" : "Copier"}
                </button>
              </div>
            </div>
          </div>

          {/* Étape 2 */}
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              2. Sur la page de <strong>confirmation de commande</strong>
            </p>
            <div className="mt-1.5 overflow-hidden rounded-xl border border-zinc-100">
              <pre className="overflow-x-auto bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100">
                <code>{dropThanks}</code>
              </pre>
              <div className="flex items-center justify-end bg-zinc-50 px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => copy("drop-thanks", dropThanks)}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-white"
                >
                  {copied === "drop-thanks" ? "Copié ✓" : "Copier"}
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-zinc-400">
              Remplace <code className="font-mono">MONTANT_TOTAL</code> par le montant TTC (nombre)
              et <code className="font-mono">ORDER_ID_UNIQUE</code> par l&apos;ID de commande
              (ex. <code className="font-mono">{"{{ checkout.order_number }}"}</code> sur Shopify).
            </p>
          </div>

          <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">
            🔐 Sécurité : on accepte les pixels uniquement si le <code className="font-mono">Referer</code>{" "}
            de l&apos;appel correspond au site enregistré de ta marque{website ? ` (${website})` : ""}.
            Idéal pour les boutiques sans dev. Pour de la sécurité maximale (e.g. Shopify Plus avec
            un dev), passe par l&apos;onglet <strong>Sécurisé (serveur)</strong>.
          </div>
        </div>
      )}

      {/* === MODE POSTBACK SERVEUR ==================================== */}
      {mode === "server" && (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-zinc-600">
            Appelle l&apos;endpoint depuis ton serveur avec ta clé secrète. Le plus sûr.
          </p>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Endpoint</p>
            <div className="mt-1 flex items-center gap-2">
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
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Clé secrète marque
            </p>
            <div className="mt-1 flex items-center gap-2">
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
            </div>
            <p className="mt-1.5 text-xs text-zinc-400">
              ⚠️ Garde-la sur ton serveur, jamais dans le navigateur.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-100">
            <div className="flex items-center justify-between bg-zinc-50 px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Exemple Node
              </span>
              <button
                type="button"
                onClick={() => copy("server-snippet", serverSnippet)}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-white"
              >
                {copied === "server-snippet" ? "Copié ✓" : "Copier"}
              </button>
            </div>
            <pre className="overflow-x-auto bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100">
              <code>{serverSnippet}</code>
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
