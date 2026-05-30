"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Mode = "drop" | "server";
type Platform = "shopify" | "woocommerce" | "wix" | "squarespace" | "custom" | "other";

const PLATFORMS: { id: Platform; label: string; icon: string; sub: string }[] = [
  { id: "shopify", label: "Shopify", icon: "🛍️", sub: "Le plus courant en e-commerce" },
  { id: "woocommerce", label: "WordPress / WooCommerce", icon: "📦", sub: "Avec un plugin gratuit" },
  { id: "wix", label: "Wix", icon: "🟦", sub: "Studio ou éditeur classique" },
  { id: "squarespace", label: "Squarespace", icon: "⬛", sub: "Code Injection" },
  { id: "custom", label: "Site custom / avec dev", icon: "🧑‍💻", sub: "Tu as un développeur" },
  { id: "other", label: "Autre", icon: "❓", sub: "Webflow, Prestashop, etc." },
];

type VerifyResult = {
  ok: boolean;
  installed?: boolean;
  reason?: string;
  message?: string;
  url?: string;
  error?: string;
};

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
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  // Persiste le choix de plateforme entre les visites.
  useEffect(() => {
    const saved = localStorage.getItem("collabbs_track_platform");
    if (saved && PLATFORMS.some((p) => p.id === saved)) setPlatform(saved as Platform);
  }, []);
  useEffect(() => {
    if (platform) localStorage.setItem("collabbs_track_platform", platform);
  }, [platform]);

  const scriptSrc = `${origin}/track.js`;
  const endpoint = `${origin}/api/track/sale`;
  const masked = "•".repeat(Math.max(8, Math.min(48, secret.length)));
  const headSnippet = `<script src="${scriptSrc}" data-brand="${brandId}"></script>`;

  function copy(label: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  async function verify() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/track/verify-install");
      const data = (await res.json()) as VerifyResult;
      setVerifyResult(data);
    } catch {
      setVerifyResult({ ok: false, error: "Impossible de vérifier." });
    }
    setVerifying(false);
  }

  // Snippets de la 2ᵉ étape (page de remerciement), par plateforme.
  const saleSnippets: Record<Platform, string> = {
    shopify: `<script>Collabbs.trackSale({{ checkout.total_price | money_without_currency }}, "{{ checkout.order_number }}");</script>`,
    woocommerce: `add_action('woocommerce_thankyou', function ($order_id) {
  $order = wc_get_order($order_id);
  $total  = $order->get_total();
  $number = $order->get_order_number();
  echo "<script>Collabbs.trackSale(" . $total . ", '" . esc_js($number) . "');</script>";
});`,
    wix: `// Dans Velo (Wix Editor → Dev Mode → Code) — fichier backend ou page de confirmation :
import wixWindow from 'wix-window';
wixWindow.trackSale = (amount, orderId) => {
  // appel équivalent à Collabbs.trackSale(amount, orderId)
};
// → Voir la documentation Wix Velo + nous contacter si besoin.`,
    squarespace: `<script>Collabbs.trackSale({orderSubtotal}, "{orderId}");</script>`,
    custom: `<script>
  // Remplace les valeurs par celles de TA commande :
  Collabbs.trackSale(49.99, "ORD-12345");
</script>`,
    other: `<script>Collabbs.trackSale(MONTANT_TOTAL, "ORDER_ID_UNIQUE");</script>`,
  };

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
          ⚡ Guidé (recommandé)
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
          🔒 Sécurité maximale (serveur)
        </button>
      </div>

      {/* === MODE GUIDÉ ============================================== */}
      {mode === "drop" && (
        <div className="mt-5">
          {!website && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              ⚠️ Renseigne d&apos;abord <strong>le site web de ta marque</strong> dans{" "}
              <Link href="/onboarding/brand" className="underline">
                Mon profil
              </Link>{" "}
              — on en a besoin pour valider l&apos;origine des ventes.
            </div>
          )}

          {/* Étape A : choisir la plateforme */}
          {!platform ? (
            <>
              <p className="text-sm font-semibold text-ink">
                1. Où est hébergé ton site ?
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                On te donne ensuite les instructions exactes pour ta plateforme.
              </p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 text-left transition hover:border-brand hover:shadow-sm"
                  >
                    <span className="text-2xl">{p.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{p.label}</span>
                      <span className="block text-xs text-zinc-500">{p.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">
                  Plateforme : {PLATFORMS.find((p) => p.id === platform)?.icon}{" "}
                  <strong>{PLATFORMS.find((p) => p.id === platform)?.label}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPlatform(null);
                    setVerifyResult(null);
                  }}
                  className="text-xs font-medium text-zinc-500 hover:text-ink hover:underline"
                >
                  ← Changer
                </button>
              </div>

              {/* === ÉTAPE 1 — Installer le script === */}
              <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
                <p className="font-display font-black text-ink">
                  Étape 1 — Installer le script (une fois pour tout le site)
                </p>
                <PlatformStep1 platform={platform} />
                <SnippetBlock
                  label="Code à coller"
                  code={headSnippet}
                  copyId="head"
                  copied={copied === "head"}
                  onCopy={() => copy("head", headSnippet)}
                />
              </div>

              {/* === ÉTAPE 2 — Déclencher la vente === */}
              <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
                <p className="font-display font-black text-ink">
                  Étape 2 — Déclencher l&apos;enregistrement de la vente
                </p>
                <PlatformStep2 platform={platform} />
                <SnippetBlock
                  label={platform === "woocommerce" ? "Code PHP" : "Code à coller"}
                  code={saleSnippets[platform]}
                  copyId="sale"
                  copied={copied === "sale"}
                  onCopy={() => copy("sale", saleSnippets[platform])}
                />
              </div>

              {/* === ÉTAPE 3 — Vérification === */}
              <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
                <p className="font-display font-black text-ink">
                  Étape 3 — Vérifier que c&apos;est bien en place
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  On va aller voir ta page d&apos;accueil et confirmer que le script est détecté.
                </p>
                <button
                  type="button"
                  onClick={verify}
                  disabled={verifying || !website}
                  className="mt-3 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {verifying ? "Vérification…" : "Vérifier l'installation"}
                </button>
                {verifyResult && (
                  <div
                    className={`mt-3 rounded-xl p-3 text-sm ${
                      verifyResult.installed
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {verifyResult.installed ? (
                      <>
                        ✅ <strong>Tout est en place</strong> sur{" "}
                        <span className="font-mono text-xs">{verifyResult.url}</span>. Plus qu&apos;à
                        partager la campagne aux créateurs.
                      </>
                    ) : (
                      <>
                        ❌ {verifyResult.message ?? verifyResult.error}
                        {verifyResult.reason === "not_found" && (
                          <div className="mt-1 text-xs">
                            Astuce : assure-toi que le script est dans le{" "}
                            <code className="font-mono">&lt;head&gt;</code> de TOUTES tes pages, pas seulement la page d&apos;accueil.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* === MODE SERVEUR ============================================ */}
      {mode === "server" && (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-zinc-600">
            Pour les marques avec un dev qui veulent un appel <strong>serveur-à-serveur</strong>{" "}
            (le plus sûr, plus de pertes de cookie possibles).
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

          <SnippetBlock
            label="Exemple Node"
            code={`await fetch("${endpoint}", {
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
});`}
            copyId="server-snippet"
            copied={copied === "server-snippet"}
            onCopy={() =>
              copy(
                "server-snippet",
                `await fetch("${endpoint}", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.COLLABBS_POSTBACK_SECRET }, body: JSON.stringify({ code: "<ref>", amount: 49.99, order_id: "ORD-12345" }) });`,
              )
            }
          />
        </div>
      )}
    </section>
  );
}

// ====== Sous-composants ====== //

function SnippetBlock({
  label,
  code,
  copyId,
  copied,
  onCopy,
}: {
  label: string;
  code: string;
  copyId: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
      <div className="flex items-center justify-between bg-zinc-100 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300 transition hover:bg-white"
        >
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100">
        <code>{code}</code>
        <span aria-hidden className="hidden">
          {copyId}
        </span>
      </pre>
    </div>
  );
}

function PlatformStep1({ platform }: { platform: Platform }) {
  switch (platform) {
    case "shopify":
      return (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
          <li>Dans l&apos;admin Shopify → <strong>Sales channels → Online Store → Themes</strong>.</li>
          <li>Sur ton thème en cours → bouton <strong>« ··· » → Edit code</strong>.</li>
          <li>Ouvre le fichier <code className="font-mono">theme.liquid</code> (dossier Layout).</li>
          <li>Colle le code ci-dessous <strong>juste avant la balise</strong> <code className="font-mono">&lt;/head&gt;</code>, puis <strong>Save</strong>.</li>
        </ol>
      );
    case "woocommerce":
      return (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
          <li>Dans WP-Admin → <strong>Extensions → Ajouter</strong> → cherche <strong>« Insert Headers and Footers »</strong> (gratuit, WPCode) → <strong>Installer</strong> & <strong>Activer</strong>.</li>
          <li>Va dans <strong>Réglages → WPCode (Headers & Footers)</strong>.</li>
          <li>Colle le code dans la zone <strong>« Scripts in Header »</strong>, puis <strong>Save</strong>.</li>
        </ol>
      );
    case "wix":
      return (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
          <li>Tableau de bord Wix → <strong>Paramètres → Marketing & SEO → Outils de suivi</strong>.</li>
          <li>Clique <strong>« + Ajouter un outil personnalisé »</strong> → choisis <strong>Custom</strong>.</li>
          <li>Colle le code, sélectionne <strong>« Toutes les pages »</strong> et l&apos;emplacement <strong>« Head »</strong>.</li>
          <li><strong>Appliquer</strong>.</li>
        </ol>
      );
    case "squarespace":
      return (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
          <li>Dans le dashboard → <strong>Settings → Advanced → Code Injection</strong>.</li>
          <li>Colle le code dans le champ <strong>« HEADER »</strong>.</li>
          <li><strong>Save</strong>.</li>
        </ol>
      );
    case "custom":
      return (
        <p className="mt-2 text-sm text-zinc-600">
          Demande à ton dev de coller le code <strong>juste avant la balise</strong>{" "}
          <code className="font-mono">&lt;/head&gt;</code> du template global (toutes les pages doivent l&apos;avoir).
        </p>
      );
    default:
      return (
        <p className="mt-2 text-sm text-zinc-600">
          Tu dois pouvoir injecter un script HTML dans le <code className="font-mono">&lt;head&gt;</code>{" "}
          de toutes tes pages. Cherche « ajouter un script header » dans les paramètres de ta
          plateforme, ou contacte ton dev.
        </p>
      );
  }
}

function PlatformStep2({ platform }: { platform: Platform }) {
  switch (platform) {
    case "shopify":
      return (
        <>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
            <li>Va dans <strong>Settings → Checkout</strong> dans l&apos;admin Shopify.</li>
            <li>Trouve la section <strong>« Order status page » → « Additional scripts »</strong>.</li>
            <li>Colle le code ci-dessous, puis <strong>Save</strong>. Les variables{" "}
              <code className="font-mono">{"{{ checkout.total_price }}"}</code> et{" "}
              <code className="font-mono">{"{{ checkout.order_number }}"}</code> sont automatiquement remplies par Shopify.
            </li>
          </ol>
        </>
      );
    case "woocommerce":
      return (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
          <li>Apparence → <strong>Éditeur de thème → fichier <code className="font-mono">functions.php</code></strong> (idéalement un <em>child theme</em>).</li>
          <li>Colle le code PHP ci-dessous à la fin du fichier, puis <strong>Mettre à jour</strong>.</li>
          <li>WooCommerce déclenchera <code className="font-mono">Collabbs.trackSale</code> automatiquement à chaque commande confirmée.</li>
        </ol>
      );
    case "wix":
      return (
        <p className="mt-2 text-sm text-zinc-600">
          Wix ne donne pas un accès direct à la page de remerciement. Le plus simple : passer par{" "}
          <strong>Wix Velo</strong> (mode dev) et écouter l&apos;événement{" "}
          <code className="font-mono">wixStores.onOrderPaid</code> pour appeler{" "}
          <code className="font-mono">Collabbs.trackSale</code>. Si tu n&apos;es pas à l&apos;aise avec Velo,{" "}
          <strong>contacte-nous</strong>, on t&apos;aide à mettre ça en place.
        </p>
      );
    case "squarespace":
      return (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
          <li>Disponible uniquement sur les plans <strong>Commerce</strong> Squarespace.</li>
          <li>Dans <strong>Commerce → Checkout → Custom Order Confirmation</strong>.</li>
          <li>Colle le code ; remplace les variables par les bons placeholders de ton template.</li>
        </ol>
      );
    case "custom":
      return (
        <p className="mt-2 text-sm text-zinc-600">
          Sur la page de confirmation de commande, dans le HTML rendu côté client,
          inclus le script en remplaçant le montant et l&apos;ID de commande par les valeurs réelles.
        </p>
      );
    default:
      return (
        <p className="mt-2 text-sm text-zinc-600">
          Sur ta page de confirmation de commande, injecte un script qui appelle{" "}
          <code className="font-mono">Collabbs.trackSale(montant, &quot;orderId&quot;)</code> avec les valeurs réelles.
        </p>
      );
  }
}
