"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerEngagement, rompreEngagement, ouvrirLeMoisSuivant } from "../../engagements/actions";
import {
  DUREES_ENGAGEMENT,
  coutTotal,
  libelleEngagement,
  moisRestants,
  prochaineEcheance,
} from "@/lib/ambassadeur";
import { eur } from "@/lib/deal";

export type EngagementVu = {
  id: string;
  monthly_amount: number;
  contents_per_month: number;
  months_total: number;
  months_created: number;
  starts_at: string;
  status: "active" | "ended";
};

/**
 * Le partenariat récurrent, des deux côtés.
 *
 * Deux états seulement : le proposer, ou le suivre. Et une règle d'écriture qui
 * traverse les deux — **on ne laisse jamais croire que les mois à venir sont
 * acquis.** Chaque mois se paie à son tour ; l'engagement est un plan, pas une
 * dette. Un créateur qui refuserait d'autres contrats en croyant avoir douze
 * mois en banque se ferait piéger par notre vocabulaire.
 */
export default function EngagementPanel({
  dealId,
  role,
  engagement,
  montantSuggere,
  quantiteSuggeree,
}: {
  dealId: string;
  role: "brand" | "creator";
  engagement: EngagementVu | null;
  montantSuggere: number;
  quantiteSuggeree: number;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [mois, setMois] = useState<number>(6);
  const [contenus, setContenus] = useState(Math.max(1, quantiteSuggeree));
  const [montant, setMontant] = useState(Math.max(1, montantSuggere));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lancer(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (res.ok) {
      setOuvert(false);
      router.refresh();
    } else setError(res.error ?? "Erreur.");
  }

  // ─── Suivi d'un partenariat en cours ───
  if (engagement) {
    const restants = moisRestants(engagement.months_total, engagement.months_created);
    const suivante = prochaineEcheance(engagement.starts_at, engagement.months_created);
    return (
      <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-black text-ink">Partenariat récurrent</h2>
          <span className="text-sm text-zinc-500">
            Mois <strong className="text-ink">{engagement.months_created}</strong> sur{" "}
            {engagement.months_total}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {libelleEngagement(
            engagement.months_total,
            engagement.contents_per_month,
            engagement.monthly_amount,
          )}
        </p>

        {engagement.status === "ended" ? (
          <p className="mt-4 rounded-xl bg-zinc-100 p-4 text-sm text-zinc-600">
            Ce partenariat a pris fin. Aucun nouveau mois ne sera ouvert — les collaborations déjà
            en cours continuent normalement jusqu&apos;à leur terme.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">
              {restants > 0 ? (
                <>
                  Encore <strong className="text-ink">{restants} mois</strong> à ouvrir. Le prochain
                  arrive le{" "}
                  <strong className="text-ink">
                    {new Date(suivante).toLocaleDateString("fr-FR")}
                  </strong>
                  .
                  {/* La phrase qui empêche le malentendu le plus coûteux. */}
                  <span className="mt-1 block text-xs text-zinc-500">
                    Chaque mois se règle à son ouverture : les mois à venir ne sont pas séquestrés
                    d&apos;avance.
                  </span>
                </>
              ) : (
                <>Tous les mois convenus ont été ouverts.</>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {role === "brand" && restants > 0 && (
                <button
                  type="button"
                  onClick={() => lancer(() => ouvrirLeMoisSuivant(engagement.id))}
                  disabled={busy}
                  className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "…" : "Ouvrir le mois suivant maintenant"}
                </button>
              )}
              {/* Les DEUX peuvent rompre. Un engagement que seule la marque
                  pourrait arrêter serait un piège pour le créateur. */}
              <button
                type="button"
                onClick={() => lancer(() => rompreEngagement(engagement.id))}
                disabled={busy}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:text-ink disabled:opacity-50"
              >
                Mettre fin au partenariat
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // ─── Proposition, côté marque uniquement ───
  if (role !== "brand") return null;

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-black text-ink">Partenariat récurrent</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Reconduire cette collaboration chaque mois, avec le même créateur. Une nouvelle
        collaboration s&apos;ouvre automatiquement à chaque échéance.
      </p>

      {!ouvert ? (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
        >
          🤝 En faire un ambassadeur
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Durée</span>
              <span className="mt-1 grid grid-cols-3 gap-1">
                {DUREES_ENGAGEMENT.map((d) => (
                  <span
                    key={d}
                    onClick={() => setMois(d)}
                    className={`cursor-pointer rounded-lg border py-2 text-center text-sm font-semibold transition ${
                      mois === d
                        ? "border-purple-400 bg-purple-50 text-ink"
                        : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    {d} mois
                  </span>
                ))}
              </span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Contenus par mois</span>
              <input
                type="number"
                min={1}
                max={100}
                value={contenus}
                onChange={(e) => setContenus(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Montant mensuel (€)</span>
              <input
                type="number"
                min={1}
                value={montant}
                onChange={(e) => setMontant(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </label>
          </div>

          {/* Le TOTAL, en gras. Le montant mensuel fait toujours paraître un
              engagement plus petit qu'il n'est ; c'est ce chiffre-là que la
              marque doit avoir en tête au moment de cliquer. */}
          <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600">
            {libelleEngagement(mois, contenus, montant)} — soit{" "}
            <strong className="text-ink">{eur(coutTotal(montant, mois))}</strong> sur la durée,
            réglés mois par mois.
            <span className="mt-1 block text-xs text-zinc-500">
              Tu peux y mettre fin à tout moment : les mois non ouverts ne sont pas dus.
            </span>
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                lancer(() =>
                  creerEngagement(dealId, {
                    months: mois,
                    contentsPerMonth: contenus,
                    monthlyAmount: montant,
                  }),
                )
              }
              disabled={busy}
              className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Création…" : "Proposer le partenariat"}
            </button>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
