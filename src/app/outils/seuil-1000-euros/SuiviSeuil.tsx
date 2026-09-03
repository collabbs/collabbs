"use client";

import { useState } from "react";
import DemandeModele from "./DemandeModele";
import { useStockageLocal } from "@/hooks/useStockageLocal";
import Link from "next/link";
import {
  etatParMarque,
  anneesPresentes,
  resume,
  NATURE_LABEL,
  LEGAL_THRESHOLD,
  RATIO_ALERTE,
  type Ligne,
  type Nature,
} from "@/lib/seuil-public";

const CLE = "collabbs.seuil.v1";

/**
 * Référence stable pour la liste vide.
 *
 * `useSyncExternalStore` compare les instantanés par identité : passer `[]`
 * littéral à chaque rendu produirait un objet différent à chaque fois, et
 * React reboucherait indéfiniment.
 */
const VIDE: Ligne[] = [];

const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;

/**
 * Le suivi du seuil légal, entièrement dans le navigateur.
 *
 * ─── Pourquoi rien ne part ───
 * On demande à quelqu'un de taper le nom de ses clients et ce qu'ils lui ont
 * versé. Envoyer ça sur un serveur pour un outil qu'il découvre serait à la
 * fois une mauvaise affaire pour lui et une mauvaise idée pour nous : des
 * données personnelles collectées sans compte, sans finalité claire, sans
 * durée de conservation. `localStorage` répond à tout ça d'un coup, et rend la
 * promesse vérifiable — il suffit d'ouvrir l'inspecteur.
 *
 * ─── Ce qu'il ne fait pas ───
 * Il ne se souvient de rien d'un appareil à l'autre, et il oublie tout si le
 * navigateur est nettoyé. C'est le prix, il est annoncé à l'écran, et il est
 * bien inférieur à celui d'une base de données qu'on n'a pas besoin d'avoir.
 */
export default function SuiviSeuil() {
  const [lignes, setLignes] = useStockageLocal<Ligne[]>(CLE, VIDE);
  const [annee, setAnnee] = useState(new Date().getFullYear());

  const [marque, setMarque] = useState("");
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [nature, setNature] = useState<Nature>("argent");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const etats = etatParMarque(lignes, annee);
  // Le formulaire du modèle n'apparaît qu'une fois qu'il sert à quelque chose :
  // quand au moins une marque a franchi le seuil, ou s'en approche.
  const marquesAuDessus = etats.filter((e) => e.obligatoire).length;
  const marquesQuiApprochent = etats.filter((e) => e.approche && !e.obligatoire).length;
  const annees = anneesPresentes(lignes);
  const anneesAffichees = annees.includes(annee) ? annees : [annee, ...annees];

  function ajouter() {
    const m = Number(montant);
    if (!marque.trim() || !Number.isFinite(m) || m <= 0) return;
    setLignes((c) => [
      ...c,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        marque: marque.trim(),
        libelle: libelle.trim() || "Collaboration",
        montant: m,
        nature,
        date,
      },
    ]);
    setLibelle("");
    setMontant("");
  }

  const pretAAjouter = marque.trim().length > 0 && Number(montant) > 0;

  return (
    <div className="mt-8">
      {/* ── Saisie ── */}
      <div className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm sm:p-7">
        <h2 className="font-display text-lg font-black text-ink">Ajouter une collaboration</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Toutes, y compris celles faites en dehors de Collabbs — c&apos;est le cumul
          total qui compte pour la loi.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="marque" className="block text-sm font-semibold text-ink">
              Marque
            </label>
            <input
              id="marque"
              value={marque}
              onChange={(e) => setMarque(e.target.value)}
              placeholder="Nom de l'annonceur"
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
            />
          </div>
          <div>
            <label htmlFor="libelle" className="block text-sm font-semibold text-ink">
              Intitulé <span className="font-normal text-zinc-400">(facultatif)</span>
            </label>
            <input
              id="libelle"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Vidéo TikTok, produit offert…"
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
            />
          </div>
          <div>
            <label htmlFor="montant" className="block text-sm font-semibold text-ink">
              Montant HT
            </label>
            <div className="mt-1.5 flex items-center rounded-xl border border-zinc-300 px-3 focus-within:border-purple-400">
              <input
                id="montant"
                value={montant}
                onChange={(e) => setMontant(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="300"
                className="w-full bg-transparent py-2.5 text-sm tabular-nums outline-none"
              />
              <span className="text-sm text-zinc-400">€</span>
            </div>
          </div>
          <div>
            <label htmlFor="date" className="block text-sm font-semibold text-ink">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(["argent", "nature"] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNature(n)}
              aria-pressed={n === nature}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                n === nature
                  ? "bg-ink text-white"
                  : "text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {NATURE_LABEL[n]}
            </button>
          ))}
          <span className="text-xs text-zinc-400">
            Un produit offert compte pour sa valeur commerciale.
          </span>
        </div>

        <button
          type="button"
          onClick={ajouter}
          disabled={!pretAAjouter}
          className="mt-5 w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 sm:w-auto sm:px-8"
        >
          Ajouter
        </button>
      </div>

      {/* ── Sélecteur d'année ── */}
      {anneesAffichees.length > 1 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Année
          </span>
          {anneesAffichees.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAnnee(a)}
              aria-pressed={a === annee}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium tabular-nums transition ${
                a === annee
                  ? "bg-ink text-white"
                  : "text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {/* ── Résultats ── */}
      <div className="mt-6 space-y-4">
        {etats.length === 0 && (
          <div className="rounded-3xl border border-dashed border-zinc-200 bg-white p-10 text-center">
            <p className="text-2xl">📊</p>
            <p className="mt-2 font-semibold text-ink">Rien à afficher pour {annee}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
              Ajoute tes collaborations de l&apos;année, argent et produits offerts
              confondus. Le compteur se tient par marque, comme la loi l&apos;exige.
            </p>
          </div>
        )}

        {etats.map((e) => {
          const pct = Math.min(100, Math.round((e.total / LEGAL_THRESHOLD) * 100));
          const ton = e.obligatoire
            ? { bord: "border-amber-300", fond: "bg-amber-50", barre: "bg-amber-500", texte: "text-amber-900" }
            : e.approche
              ? { bord: "border-amber-200", fond: "bg-amber-50/50", barre: "bg-amber-400", texte: "text-amber-800" }
              : { bord: "border-zinc-100", fond: "bg-white", barre: "bg-emerald-500", texte: "text-zinc-600" };

          return (
            <div key={e.marque} className={`rounded-3xl border ${ton.bord} ${ton.fond} p-5 shadow-sm sm:p-6`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-lg font-black text-ink">{e.marque}</h3>
                <p className="font-display text-2xl font-black tabular-nums text-ink">
                  {eur(e.total)}
                  <span className="ml-1.5 align-middle text-sm font-medium text-zinc-400">
                    / {eur(LEGAL_THRESHOLD)}
                  </span>
                </p>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200/70">
                <div
                  className={`h-full rounded-full transition-all ${ton.barre}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className={`mt-3 text-sm font-medium ${ton.texte}`}>
                {e.obligatoire && "⚠️ "}
                {resume(e)}
              </p>

              {e.nature > 0 && (
                <p className="mt-1.5 text-xs text-zinc-500">
                  {/* `{" "}` explicite : JSX supprime l'espace qui suit une
                      expression quand le texte se poursuit à la ligne
                      suivante. Sans lui, ça rend « 250 €en avantages ». */}
                  Dont {eur(e.nature)}{" "}
                  en avantages en nature, qui comptent au même titre
                  que l&apos;argent versé.
                </p>
              )}

              <ul className="mt-4 divide-y divide-zinc-200/70 border-t border-zinc-200/70 pt-1">
                {e.lignes.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0 text-sm text-zinc-600">
                      <span className="text-zinc-400 tabular-nums">
                        {l.date.split("-").reverse().join("/")}
                      </span>{" "}
                      · {l.libelle}
                      {l.nature === "nature" && (
                        <span className="ml-1.5 rounded-full bg-zinc-200/70 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                          en nature
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-ink">
                        {eur(l.montant)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLignes((c) => c.filter((x) => x.id !== l.id))}
                        aria-label={`Retirer ${l.libelle}`}
                        className="text-zinc-400 transition hover:text-red-600"
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
              </ul>

              {e.obligatoire && (
                <Link
                  href="/signup"
                  className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                >
                  Faire générer le contrat
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {(marquesAuDessus > 0 || marquesQuiApprochent > 0) && (
        <DemandeModele
          marquesAuDessus={marquesAuDessus}
          marquesQuiApprochent={marquesQuiApprochent}
        />
      )}

      {lignes.length > 0 && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Effacer toutes les lignes enregistrées dans ce navigateur ?")) {
              setLignes([]);
            }
          }}
          className="mt-6 text-xs font-medium text-zinc-400 underline underline-offset-2 hover:text-red-600"
        >
          Tout effacer
        </button>
      )}

      <p className="mt-8 rounded-2xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-500">
        <strong className="font-semibold text-zinc-700">Rien ne quitte ton navigateur.</strong>{" "}
        Ces lignes sont enregistrées localement, sur cet appareil uniquement. Elles ne
        sont envoyées nulle part, et elles disparaîtront si tu nettoies ton navigateur.
        L&apos;alerte se déclenche à {Math.round(RATIO_ALERTE * 100)} % du seuil pour
        laisser le temps de préparer le contrat avant la prestation qui le franchit.
      </p>
    </div>
  );
}
