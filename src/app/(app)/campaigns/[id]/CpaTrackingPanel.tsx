"use client";

import { useState } from "react";

/**
 * Comment brancher une campagne payée à l'action.
 *
 * Une action — une inscription, un essai, un devis — n'est constatable que
 * chez la marque : elle seule voit l'inscription arriver dans son système.
 * Il n'existe donc pas d'équivalent au script « à coller », qui tournerait
 * dans le navigateur du visiteur sans rien pouvoir prouver. L'appel se fait
 * depuis le serveur de la marque, authentifié par son secret.
 */
export default function CpaTrackingPanel({
  origin,
  secret,
  actionLabel,
}: {
  origin: string;
  secret: string | null;
  actionLabel: string;
}) {
  const [copie, setCopie] = useState<string | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);

  const endpoint = `${origin}/api/track/action`;
  const secretAffiche = secret
    ? secretVisible
      ? secret
      : secret.slice(0, 4) + "•".repeat(Math.max(0, secret.length - 4))
    : "—";

  const commande = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${secret ?? "<ton_secret>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"code":"<code du lien du créateur>","action_id":"<identifiant unique>","count":1}'`;

  const copier = async (texte: string, quoi: string) => {
    await navigator.clipboard.writeText(texte);
    setCopie(quoi);
    setTimeout(() => setCopie(null), 2000);
  };

  return (
    <section className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/30 p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-black text-ink">
        🔌 Brancher le suivi des {actionLabel}s
      </h2>
      <p className="mt-2 text-sm text-zinc-600">
        Une {actionLabel} ne se constate que chez toi : ton serveur nous prévient
        quand elle a lieu. Donne ceci à ton développeur — c&apos;est une seule
        requête à envoyer au moment où tu enregistres l&apos;{actionLabel}.
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl bg-zinc-900 p-4">
        <pre className="text-xs leading-relaxed text-zinc-100">
          <code>{commande}</code>
        </pre>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => copier(commande, "commande")}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {copie === "commande" ? "Copié ✓" : "Copier la commande"}
        </button>
        <span className="text-xs text-zinc-500">
          Secret :{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono ring-1 ring-zinc-200">
            {secretAffiche}
          </code>{" "}
          <button
            type="button"
            onClick={() => setSecretVisible((v) => !v)}
            className="font-medium text-emerald-700 underline underline-offset-2"
          >
            {secretVisible ? "masquer" : "afficher"}
          </button>
        </span>
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <div>
          <dt className="font-semibold text-ink">
            <code className="text-xs">code</code>
          </dt>
          <dd className="text-zinc-600">
            Le code du lien du créateur, celui que tu retrouves dans l&apos;URL
            de son lien d&apos;affiliation. C&apos;est lui qui attribue l&apos;
            {actionLabel} au bon créateur.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">
            <code className="text-xs">action_id</code>
          </dt>
          <dd className="text-zinc-600">
            Un identifiant unique de ton côté — l&apos;identifiant de
            l&apos;inscription, de la commande, du dossier. Si tu renvoies deux
            fois le même, il n&apos;est compté qu&apos;une fois : tu peux
            réessayer sans risque de payer en double.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">
            <code className="text-xs">count</code>
          </dt>
          <dd className="text-zinc-600">
            Le nombre d&apos;{actionLabel}s déclarées par cet appel. 1 par
            défaut.
          </dd>
        </div>
      </dl>

      <p className="mt-5 rounded-xl bg-white p-3 text-xs text-zinc-600 ring-1 ring-emerald-100">
        <strong className="text-ink">Garde ce secret sur ton serveur.</strong> Ne
        le mets jamais dans une page web ni dans une adresse : qui le détient
        peut déclarer des {actionLabel}s à ta place, et donc engager ton budget.
      </p>
    </section>
  );
}
