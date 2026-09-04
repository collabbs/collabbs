"use client";

import { useState } from "react";
import Link from "next/link";
import { useStockageLocal } from "@/hooks/useStockageLocal";
import { NICHES, OFFER_TYPES, type OfferId } from "@/components/landing/creators";
import PlatformIcon from "@/components/PlatformIcon";
import CarteApercu from "./CarteApercu";
import {
  CLE_CARTE,
  TRANCHES_AUDIENCE,
  avancementCreateur,
  carteCreateurVide,
  lireLienProfil,
  premiereEtapeIncomplete,
  type CarteCreateur,
  type TrancheId,
} from "@/lib/quiz";

/**
 * Le questionnaire créateur.
 *
 * ─── Cinq questions, une par écran ───
 * Une seule question à la fois, avec la carte qui se remplit à côté. Un
 * formulaire de quinze champs se ferme ; cinq questions qui font apparaître
 * quelque chose se terminent.
 *
 * ─── Rien n'est perdu, jamais ───
 * Les réponses vont dans le navigateur à chaque frappe. Quelqu'un qui part et
 * revient retrouve sa carte — c'est le même mécanisme que l'outil du seuil, et
 * c'est ce qui permettra plus tard de convertir la carte en profil au moment
 * de l'inscription, sans rien redemander.
 *
 * ─── L'échappatoire est visible partout ───
 * Une marque sans idée de campagne, un créateur qui découvre : ils doivent
 * pouvoir sortir vers l'explication à tout moment plutôt que d'abandonner
 * devant une question. On les perd au bon endroit, pas à la porte.
 */

const RESEAUX = ["tiktok", "instagram", "youtube", "twitch", "twitter"] as const;
const NOMS_RESEAUX: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitch: "Twitch",
  twitter: "X",
};

export default function QuizCreateur() {
  const [carte, setCarte] = useStockageLocal<CarteCreateur>(CLE_CARTE, carteCreateurVide());
  // `null` = « on n'a pas encore choisi », donc on déduit de la carte. Dérivé
  // pendant le rendu plutôt que dans un effet : ça évite un rendu en cascade,
  // et surtout un décalage entre le serveur et le navigateur au premier
  // affichage.
  const [etapeChoisie, setEtapeChoisie] = useState<number | null>(null);
  const [lien, setLien] = useState("");
  const [reseauChoisi, setReseauChoisi] = useState<string | null>(null);
  const [erreurLien, setErreurLien] = useState<string | null>(null);

  const etape = etapeChoisie ?? premiereEtapeIncomplete(carte);
  const setEtape = setEtapeChoisie;
  const avancement = avancementCreateur(carte);
  const maj = (patch: Partial<CarteCreateur>) => setCarte((p) => ({ ...p, ...patch }));

  function validerLien() {
    const lu = lireLienProfil(lien, reseauChoisi ?? undefined);
    if (!lu) {
      setErreurLien(
        reseauChoisi
          ? "On n'arrive pas à lire ça. Colle le lien de ton profil, ou juste ton pseudo."
          : "Colle le lien de ton profil — ou choisis d'abord ton réseau, puis ton pseudo suffira.",
      );
      return;
    }
    setErreurLien(null);
    maj({ handle: lu.handle, plateforme: lu.plateforme });
    setEtape(1);
  }

  function basculer<T>(liste: T[], valeur: T): T[] {
    return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
  }

  const ETAPES = [
    /* ── 0 ─────────────────────────────────────────────── pseudo + réseau ── */
    {
      question: "Ton compte principal, c'est lequel ?",
      aide: "Colle le lien de ton profil. On en tire ton pseudo et ton réseau tout seuls.",
      contenu: (
        <div>
          <div className="flex flex-wrap gap-2">
            {RESEAUX.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReseauChoisi(reseauChoisi === r ? null : r)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  reseauChoisi === r
                    ? "border-transparent bg-ink text-white"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
              >
                <PlatformIcon slug={r} className="h-4 w-4" />
                {NOMS_RESEAUX[r]}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={lien}
            onChange={(e) => {
              setLien(e.target.value);
              setErreurLien(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && validerLien()}
            placeholder="tiktok.com/@ton.pseudo"
            className="mt-4 w-full rounded-xl border border-zinc-200 px-4 py-3 text-base outline-none focus:border-purple-400"
          />
          {erreurLien && <p className="mt-2 text-sm text-red-600">{erreurLien}</p>}

          <button
            type="button"
            onClick={validerLien}
            disabled={!lien.trim()}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Continuer
          </button>
        </div>
      ),
    },

    /* ── 1 ────────────────────────────────────────────────────── audience ── */
    {
      question: "Tu réunis combien de personnes ?",
      aide: "Une fourchette suffit. Personne ne connaît son compte au millier près.",
      contenu: (
        <div className="grid gap-2">
          {TRANCHES_AUDIENCE.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                maj({ audience: t.id as TrancheId });
                setEtape(2);
              }}
              className={`flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition ${
                carte.audience === t.id
                  ? "border-transparent bg-ink text-white"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <span className="text-base font-semibold">{t.label}</span>
              <span
                className={`text-xs font-bold ${carte.audience === t.id ? "text-white/60" : "text-zinc-400"}`}
              >
                {t.palier}
              </span>
            </button>
          ))}
        </div>
      ),
    },

    /* ── 2 ───────────────────────────────────────────────────────── niche ── */
    {
      question: "Tu parles de quoi ?",
      aide: "Une ou deux, pas plus — c'est ce qui rend un profil trouvable.",
      contenu: (
        <div>
          <div className="flex flex-wrap gap-2">
            {NICHES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => maj({ niches: basculer(carte.niches, n) })}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  carte.niches.includes(n)
                    ? "border-transparent bg-ink text-white"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEtape(3)}
            disabled={carte.niches.length === 0}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Continuer
          </button>
        </div>
      ),
    },

    /* ── 3 ────────────────────────────────────────────────────── formats ─── */
    {
      question: "Tu proposes quoi aux marques ?",
      aide: "Tout ce que tu acceptes de faire. Tu pourras en retirer plus tard.",
      contenu: (
        <div>
          <div className="grid gap-2">
            {OFFER_TYPES.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => maj({ offres: basculer(carte.offres, o.id as OfferId) })}
                className={`flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition ${
                  carte.offres.includes(o.id as OfferId)
                    ? "border-transparent bg-ink text-white"
                    : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-base font-semibold">
                  {o.emoji} {o.label}
                </span>
                <span
                  className={`text-xs font-medium ${
                    carte.offres.includes(o.id as OfferId) ? "text-white/60" : "text-zinc-400"
                  }`}
                >
                  {o.tag}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEtape(4)}
            disabled={carte.offres.length === 0}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Continuer
          </button>
        </div>
      ),
    },

    /* ── 4 ─────────────────────────────────────────────────────── tarif ──── */
    {
      question: "À partir de combien tu travailles ?",
      aide: "Ton prix d'entrée, pour la prestation la plus simple. Il te protège des propositions à 20 €.",
      contenu: (
        <div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={carte.prixMini ?? ""}
              onChange={(e) =>
                maj({ prixMini: e.target.value === "" ? null : Number(e.target.value) })
              }
              placeholder="220"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-base outline-none focus:border-purple-400"
            />
            <span className="text-lg font-bold text-zinc-400">€</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            Tu ne sais pas quoi mettre ? Le prix moyen constaté en France pour une
            vidéo UGC de 30 s est de 28 €, et les plateformes annoncent une entrée
            de gamme à partir de 80 €. À toi de te situer.
          </p>
        </div>
      ),
    },
  ];

  const courante = ETAPES[etape];
  const fini = avancement.pourcentage === 100;

  return (
    <div className="mx-auto grid min-h-dvh max-w-5xl grid-cols-1 gap-6 px-5 py-6 lg:gap-10 lg:grid-cols-[1fr_320px] lg:items-center lg:py-16">
      {/* ── Colonne des questions ── */}
      <div className="order-2 lg:order-1">
        {/* Avancement */}
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
              style={{ width: `${avancement.pourcentage}%` }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums text-zinc-400">
            {etape + 1}/{ETAPES.length}
          </span>
        </div>

        <h1 className="font-display mt-6 text-3xl font-black leading-tight tracking-tight text-ink sm:text-4xl">
          {courante.question}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-zinc-500">{courante.aide}</p>

        <div className="mt-6">{courante.contenu}</div>

        {/* Navigation + échappatoire */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {etape > 0 ? (
            <button
              type="button"
              onClick={() => setEtape(etape - 1)}
              className="text-sm font-medium text-zinc-500 transition hover:text-ink"
            >
              ← Retour
            </button>
          ) : (
            <span />
          )}

          {/* Toujours visible. Quelqu'un qui bloque doit sortir vers
              l'explication, pas fermer l'onglet. */}
          <Link
            href="/decouvrir"
            className="text-sm font-medium text-zinc-400 underline underline-offset-2 transition hover:text-ink"
          >
            Je découvre Collabbs d&apos;abord
          </Link>
        </div>

        {fini && (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-display text-lg font-black text-emerald-900">
              Ta carte est prête.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-emerald-800">
              C&apos;est exactement ce qu&apos;une marque verra de toi. Prochaine
              étape : les campagnes qui cherchent quelqu&apos;un comme toi.
            </p>
          </div>
        )}
      </div>

      {/* ── Colonne de la carte ── */}
      {/* Sur téléphone, la carte est volontairement PETITE. En taille réelle
          elle occupait l'écran entier et repoussait la question hors de vue :
          on arrivait sur une image sans savoir ce qu'on nous demandait. Elle
          doit rester visible — c'est elle qui donne envie de répondre — mais
          jamais au point de cacher la question. */}
      <div className="order-1 flex justify-center lg:order-2 lg:sticky lg:top-16">
        <div className="w-full max-w-[168px] sm:max-w-[220px] lg:max-w-[300px]">
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 lg:mb-3 lg:text-xs">
            Ce que voit une marque
          </p>
          <CarteApercu carte={carte} />
        </div>
      </div>
    </div>
  );
}
