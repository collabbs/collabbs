"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PALIERS_DROITS,
  PERIMETRES,
  PERIMETRE_LABEL,
  PERIMETRE_DESCRIPTION,
  supplementDroits,
  type Perimetre,
} from "@/lib/droits";

/**
 * Le calculateur de droits d'usage.
 *
 * ─── Pourquoi cet outil, et pourquoi sans compte ───
 * C'est le poste où un créateur perd le plus d'argent sans le savoir : il
 * facture une vidéo, la marque la passe en publicité pendant un an, et personne
 * n'a jamais chiffré ce que ça valait. Les calculateurs français existants
 * traitent les droits comme une case à cocher à trente euros.
 *
 * Il est utile à quelqu'un qui n'a pas de compte et qui n'en veut pas — c'est
 * délibéré. Un outil qui exige une inscription pour donner un chiffre n'est
 * plus un outil, c'est un formulaire.
 *
 * ─── Il ne calcule rien de son côté ───
 * Toute l'arithmétique vient de `lib/droits`, la même que celle qui facture les
 * droits dans le produit. Un calculateur qui annoncerait un prix différent de
 * celui appliqué dans une vraie collaboration serait pire qu'inutile.
 */
export default function CalculateurDroits() {
  const [montant, setMontant] = useState("300");
  const [moisIdx, setMoisIdx] = useState(2); // 6 mois
  const [perimetre, setPerimetre] = useState<Perimetre>("organic");

  const base = Number(montant) || 0;
  const palier = PALIERS_DROITS[moisIdx];
  const supplement = supplementDroits(base, palier.mois, perimetre);
  const total = base + supplement;
  const pct = base > 0 ? Math.round((supplement / base) * 100) : 0;

  const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;

  return (
    <div className="mt-8 rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="montant" className="block text-sm font-semibold text-ink">
            Prix du contenu, hors droits
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            Ce que coûte la fabrication de la vidéo : tournage, montage, livraison.
          </p>
          <div className="mt-2 flex w-full items-center rounded-xl border border-zinc-300 px-3 focus-within:border-purple-400">
            <input
              id="montant"
              value={montant}
              onChange={(e) => setMontant(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              className="w-full bg-transparent py-3 text-lg font-semibold tabular-nums outline-none"
            />
            <span className="text-zinc-400">€</span>
          </div>
        </div>

        <div>
          <span className="block text-sm font-semibold text-ink">Durée de la cession</span>
          <p className="mt-1 text-xs text-zinc-500">
            Combien de temps la marque a le droit de réutiliser le contenu.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PALIERS_DROITS.map((p, i) => (
              <button
                key={p.libelle}
                type="button"
                onClick={() => setMoisIdx(i)}
                aria-pressed={i === moisIdx}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  i === moisIdx
                    ? "bg-ink text-white"
                    : "text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {p.libelle}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <span className="block text-sm font-semibold text-ink">Périmètre</span>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {PERIMETRES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPerimetre(p)}
              aria-pressed={p === perimetre}
              className={`rounded-2xl border p-4 text-left transition ${
                p === perimetre
                  ? "border-purple-300 bg-purple-50/60"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <span className="block text-sm font-semibold text-ink">
                {PERIMETRE_LABEL[p]}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                {PERIMETRE_DESCRIPTION[p]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Le résultat. Trois lignes, parce que le créateur doit pouvoir la
          recopier telle quelle dans un devis. */}
      <div className="mt-8 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-6 text-white sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
          À facturer
        </p>
        <p className="mt-2 font-display text-4xl font-black tabular-nums sm:text-5xl">
          {eur(total)}
        </p>
        <div className="mt-4 space-y-1.5 border-t border-white/25 pt-4 text-sm text-white/90">
          <p className="flex justify-between gap-4">
            <span>Contenu</span>
            <span className="tabular-nums">{eur(base)}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span>
              Droits d&apos;usage — {palier.libelle.toLowerCase()},{" "}
              {PERIMETRE_LABEL[perimetre].toLowerCase()}
            </span>
            <span className="tabular-nums">
              + {eur(supplement)} <span className="text-white/60">({pct} %)</span>
            </span>
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-zinc-500">
        Ces paliers sont ceux que pratiquent les agences UGC : un mois se négocie
        autour de +15 %, un an autour de +80 %, et une cession sans limite de durée —
        qui est un abandon définitif — autour de +150 %. La publicité payante double le
        supplément, parce qu&apos;elle met un budget média derrière le visage du
        créateur, souvent auprès d&apos;audiences qui ne le connaissent pas.
      </p>

      {base > 0 && palier.mois !== null && (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Une durée intermédiaire relève du palier qui la couvre : quatre mois se
          facturent au tarif de six. Arrondir vers le bas reviendrait à offrir deux mois
          de diffusion, et c&apos;est l&apos;erreur qui se retourne contre le créateur.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-100 pt-6">
        <Link
          href="/blog/droits-usage-ugc-combien-facturer"
          className="rounded-full px-4 py-2.5 text-sm font-semibold text-brand ring-1 ring-inset ring-purple-200 transition hover:bg-purple-50"
        >
          Comprendre les droits d&apos;usage
        </Link>
        <Link
          href="/signup"
          className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
        >
          Faire écrire ça dans un contrat
        </Link>
      </div>
    </div>
  );
}
