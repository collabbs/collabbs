"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerPropositionDirecte } from "../actions";

/**
 * Ce qu'une marque doit décider avant qu'une collaboration existe.
 *
 * Quatre champs, pas douze : un montant, un nombre de contenus, une échéance
 * facultative, et ce qu'elle attend. Tout le reste — droits d'usage,
 * exclusivité, envoi de produit — se règle ensuite dans « Modifier les termes »,
 * sur une proposition qui existe déjà. Demander tout d'un coup ferait
 * abandonner avant la première ligne.
 */
export default function FormulaireProposition({
  creatorId,
  nomCreateur,
  tarifDepart,
}: {
  creatorId: string;
  nomCreateur: string;
  tarifDepart: number | null;
}) {
  const router = useRouter();
  const [montant, setMontant] = useState(tarifDepart ? String(tarifDepart) : "");
  const [quantite, setQuantite] = useState("1");
  const [echeance, setEcheance] = useState("");
  const [titre, setTitre] = useState("");
  const [brief, setBrief] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const res = await creerPropositionDirecte(creatorId, {
      amount: Number(montant),
      quantity: Number(quantite),
      deadline: echeance || null,
      brandNotes: brief.trim() || null,
      title: titre.trim() || null,
    });
    setEnvoi(false);
    // Même refusée, la réponse peut porter la collaboration déjà ouverte :
    // on y emmène plutôt que d'afficher une impasse.
    if (res.dealId) {
      router.push(`/deals/${res.dealId}`);
      return;
    }
    if (!res.ok) {
      setErreur(res.error ?? "La proposition n'a pas pu être créée.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const champ =
    "mt-1.5 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-purple-400";
  const legende = "block text-xs font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <form onSubmit={envoyer} className="mt-7 space-y-5">
      {erreur && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{erreur}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={legende} htmlFor="montant">
            Montant pour le créateur (€)
          </label>
          <input
            id="montant"
            type="number"
            min={1}
            step={1}
            required
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            placeholder="300"
            className={champ}
          />
          <p className="mt-1 text-xs text-zinc-400">
            {tarifDepart
              ? `Son tarif affiché est de ${tarifDepart} €. Tu peux proposer autre chose.`
              : "Ce créateur n'affiche pas de tarif — à toi de proposer."}
          </p>
        </div>

        <div>
          <label className={legende} htmlFor="quantite">
            Nombre de contenus
          </label>
          <input
            id="quantite"
            type="number"
            min={1}
            max={20}
            required
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            className={champ}
          />
          <p className="mt-1 text-xs text-zinc-400">Un livrable sera créé pour chacun.</p>
        </div>
      </div>

      <div>
        <label className={legende} htmlFor="titre">
          Intitulé <span className="font-normal normal-case text-zinc-400">(facultatif)</span>
        </label>
        <input
          id="titre"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="2 vidéos pour le lancement du sérum"
          className={champ}
        />
      </div>

      <div>
        <label className={legende} htmlFor="echeance">
          Échéance <span className="font-normal normal-case text-zinc-400">(facultatif)</span>
        </label>
        <input
          id="echeance"
          type="date"
          value={echeance}
          onChange={(e) => setEcheance(e.target.value)}
          className={`${champ} sm:max-w-xs`}
        />
      </div>

      <div>
        <label className={legende} htmlFor="brief">
          Ce que tu attends{" "}
          <span className="font-normal normal-case text-zinc-400">(facultatif)</span>
        </label>
        <textarea
          id="brief"
          rows={4}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Le produit, le ton, ce qu'il faut montrer, ce qu'il faut éviter…"
          className={`${champ} resize-y`}
        />
        <p className="mt-1 text-xs text-zinc-400">
          Les droits d&apos;usage, l&apos;exclusivité et l&apos;envoi de produit se règlent
          ensuite, sur la proposition.
        </p>
      </div>

      <div className="rounded-xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-500">
        {nomCreateur} recevra la proposition et pourra l&apos;accepter ou en discuter.
        Le contrat se signe automatiquement à son acceptation, et{" "}
        <b className="text-ink">tu ne payes qu&apos;après</b> — les fonds restent bloqués
        jusqu&apos;à ce que tu valides la livraison.
      </div>

      <button
        type="submit"
        disabled={envoi}
        className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
      >
        {envoi ? "Envoi…" : "Envoyer la proposition"}
      </button>
    </form>
  );
}
