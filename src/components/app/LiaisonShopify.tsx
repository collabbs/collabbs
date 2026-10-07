import BoutonSoumettre from "@/components/BoutonSoumettre";
import { relierShopify } from "@/app/(app)/tracking/actions";

/**
 * Relier une boutique Shopify, sans développeur.
 *
 * ─── Pourquoi cet écran remplace le pixel ───
 * Le pixel personnalisé demandait à la marque de coller du JavaScript dans un
 * éditeur de code, et il ne fonctionnait pas : éprouvé sur une vraie boutique,
 * il n'atteignait jamais notre serveur. Ici elle colle deux valeurs que
 * Shopify lui donne, et c'est Shopify qui nous parle.
 *
 * ─── Pourquoi la clé ne se réaffiche jamais ───
 * On montre qu'elle est enregistrée, jamais sa valeur. Une clé affichée est une
 * clé qui se recopie, se photographie et se partage — et celle-ci autorise à
 * déclarer une vente, donc à faire payer la marque.
 */
export default function LiaisonShopify({
  origin,
  domaine,
  relie,
}: {
  origin: string;
  domaine: string | null;
  relie: boolean;
}) {
  const url = `${origin}/api/track/shopify`;

  return (
    <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-semibold text-ink">🛍️ Ta boutique Shopify</h2>
        {relie && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            ✓ Reliée — {domaine}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-zinc-600">
        Shopify nous annonce lui-même chaque commande payée. Rien à installer,
        aucun code à coller dans ton thème, et aucune vente perdue à cause d&apos;un
        bloqueur de publicité ou d&apos;un refus de cookies.
      </p>

      <ol className="mt-4 space-y-3 text-sm text-zinc-700">
        <li>
          <strong>1.</strong> Dans Shopify :{" "}
          <strong>Réglages → Notifications → Webhooks</strong>, puis{" "}
          <strong>Créer un webhook</strong>.
        </li>
        <li>
          <strong>2.</strong> Évènement <strong>« Commande payée »</strong>, format{" "}
          <strong>JSON</strong>, et cette adresse :
          <code className="mt-1.5 block overflow-x-auto rounded-xl bg-zinc-50 p-3 font-mono text-[13px] text-ink">
            {url}
          </code>
        </li>
        <li>
          <strong>3.</strong> Shopify affiche alors une <strong>clé de signature</strong>.
          Recopie-la ci-dessous avec l&apos;adresse de ta boutique.
        </li>
      </ol>

      <form action={relierShopify} className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Adresse technique de la boutique
          </span>
          <input
            name="domaine"
            type="text"
            defaultValue={domaine ?? ""}
            placeholder="ma-marque.myshopify.com"
            className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-purple-400"
          />
          {/* Beaucoup de marques ont un domaine personnalisé et ignorent qu'il
              en existe un second. C'est pourtant celui-là que Shopify envoie
              dans ses webhooks — sans lui, on ne reconnaît pas l'expéditeur. */}
          <span className="mt-1 block text-xs text-zinc-400">
            Celle qui finit par <code className="font-mono">.myshopify.com</code>, pas ton
            nom de domaine. Tu la vois dans l&apos;adresse de ton admin Shopify.
          </span>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Clé de signature
          </span>
          <input
            name="cle"
            type="password"
            autoComplete="off"
            placeholder={relie ? "••••••••  (déjà enregistrée)" : "Collée depuis Shopify"}
            className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-purple-400"
          />
          <span className="mt-1 block text-xs text-zinc-400">
            On ne la réaffiche jamais. Pour la changer, colle la nouvelle.
          </span>
        </label>

        <div className="sm:col-span-2">
          <BoutonSoumettre
            pendant="Enregistrement…"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {relie ? "Mettre à jour" : "Relier ma boutique"}
          </BoutonSoumettre>
          {relie && (
            <span className="ml-3 text-xs text-zinc-400">
              Pour délier, enregistre les deux champs vides.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
