"use client";

import { useState } from "react";
import Link from "next/link";
import { useStockageLocal, oublierStockageLocal } from "@/hooks/useStockageLocal";
import { NICHES, OFFER_TYPES, type OfferId } from "@/components/landing/creators";
import PlatformIcon from "@/components/PlatformIcon";
import CarteApercu from "./CarteApercu";
import {
  CLES_PARCOURS,
  CLE_COTE,
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
 * ─── Ce qui a changé après avoir étudié le tunnel Noom ───
 *
 * 1. **Le titre affirme, il n'interroge pas.** L'écran qui demande le sexe
 *    s'intitule chez eux « Hormones impact how our bodies metabolize food » —
 *    la question n'apparaît que dans les options. On ne se sent pas interrogé,
 *    on se sent expliqué, et on ne se demande pas pourquoi on donne ça.
 *
 * 2. **L'échappatoire est DANS les réponses**, pas en petit lien gris à côté.
 *    « Je ne sais pas encore » est une réponse légitime, pas un abandon.
 *
 * 3. **Pas de barre de progression.** Noom n'en a aucune : un intitulé de
 *    section situe sans annoncer combien il reste. Un compteur « 1/5 » donne
 *    un devoir à finir ; « Ton compte » donne l'impression d'avancer.
 *
 * 4. **Rien à l'écran que la question.** La carte ne s'affiche plus pendant
 *    qu'on répond — c'était joli et c'était du bruit. Elle devient la
 *    récompense de la fin, et c'est elle qui justifie la seule demande qu'on
 *    fera : la photo.
 */

const RESEAUX = ["tiktok", "instagram", "youtube", "twitch", "twitter"] as const;
const NOMS_RESEAUX: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitch: "Twitch",
  twitter: "X",
};

/** Bouton de réponse : pleine largeur, cible généreuse, même rendu partout. */
function Reponse({
  actif,
  onClick,
  children,
  suffixe,
}: {
  actif?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  suffixe?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[60px] w-full items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-left transition ${
        actif
          ? "border-transparent bg-ink text-white shadow-[0_12px_28px_-18px_rgba(0,0,0,.7)]"
          : "border-zinc-200 bg-white text-ink hover:border-ink hover:shadow-[0_12px_28px_-22px_rgba(0,0,0,.5)]"
      }`}
    >
      <span className="text-[15px] font-semibold leading-snug sm:text-base">{children}</span>
      {suffixe && (
        <span className={`shrink-0 text-xs font-bold ${actif ? "text-white/55" : "text-zinc-400"}`}>
          {suffixe}
        </span>
      )}
    </button>
  );
}

const BOUTON_PRINCIPAL =
  "min-h-[58px] w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-base font-bold text-white transition hover:opacity-90 disabled:opacity-30";

export default function QuizCreateur() {
  const [carte, setCarte] = useStockageLocal<CarteCreateur>(CLE_CARTE, carteCreateurVide());
  const [etapeChoisie, setEtapeChoisie] = useState<number | null>(null);
  const [lien, setLien] = useState("");
  const [reseauChoisi, setReseauChoisi] = useState<string | null>(null);
  const [erreurLien, setErreurLien] = useState<string | null>(null);
  const [revelee, setRevelee] = useState(false);

  const etape = etapeChoisie ?? premiereEtapeIncomplete(carte);
  const setEtape = setEtapeChoisie;
  const avancement = avancementCreateur(carte);
  /**
   * ⚠️ On ÉPINGLE l'étape dès la première modification.
   *
   * L'étape est déduite de ce qui est rempli, ce qui permet de reprendre au
   * bon endroit quand on revient. Mais tant qu'elle reste déduite, elle bouge
   * À CHAQUE FRAPPE : côté marque, la première question exige le nom ET la
   * description — à la première lettre de la description la question devenait
   * « complète » et l'écran sautait au milieu de la saisie.
   *
   * La déduction ne doit donc servir qu'à l'ARRIVÉE. Dès que la personne
   * touche quoi que ce soit, l'étape se fige sur celle qu'elle regarde, et
   * seuls les boutons la font bouger.
   */
  const maj = (patch: Partial<CarteCreateur>) => {
    setEtapeChoisie((precedente) => precedente ?? etape);
    setCarte((p) => ({ ...p, ...patch }));
  };

  const carteComplete = avancement.pourcentage === 100 && carte.prixMini !== null;

  function validerLien() {
    const lu = lireLienProfil(lien, reseauChoisi ?? undefined);
    if (!lu) {
      setErreurLien(
        reseauChoisi
          ? "On n'arrive pas à lire ça. Colle le lien de ton profil, ou juste ton pseudo."
          : "Choisis ton réseau, puis ton pseudo suffira — ou colle le lien complet.",
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

  /* ──────────────────────────────────── la carte, en récompense de fin ──── */
  if (revelee || (carteComplete && etapeChoisie === null)) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center px-5 py-10 text-center sm:py-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Ta carte
        </p>
        <h1 className="font-display mt-3 text-[26px] font-black leading-[1.12] tracking-tight text-ink sm:text-4xl">
          Voilà ce qu&apos;une marque verra de toi.
        </h1>

        <div className="mt-8 w-full max-w-[260px] sm:max-w-[280px]">
          <CarteApercu carte={carte} />
        </div>

        {/* ⚠️ PAS de demande de compte ici. On sortait le formulaire
            d'inscription au moment exact où la personne venait de fournir un
            effort — c'est le pire endroit possible, et c'est contraire au
            principe qu'on s'est donné : le mur se pose sur le geste qui engage
            (marquer son intérêt pour une marque), jamais sur celui qui
            n'engage rien. La suite, c'est ce pour quoi elle est venue. */}
        <p className="mt-6 text-[15px] leading-relaxed text-zinc-500">
          Des marques cherchent des créateurs en ce moment. Regarde ce
          qu&apos;elles proposent.
        </p>
        <Link
          href="/defile"
          className={`${BOUTON_PRINCIPAL} mt-5 flex items-center justify-center`}
        >
          Voir les campagnes ouvertes
        </Link>

        <button
          type="button"
          onClick={() => {
            setRevelee(false);
            setEtape(0);
          }}
          className="mt-5 text-sm font-medium text-zinc-400 underline underline-offset-2 transition hover:text-ink"
        >
          Modifier mes réponses
        </button>
        {/* Sans ça, quelqu'un qui a répondu une fois ne peut plus jamais
            recommencer : sa carte est gardée et le questionnaire reprend
            toujours à la fin. Il faut pouvoir tout effacer, y compris le côté
            choisi — sinon on reste coincé du mauvais côté. */}
        <button
          type="button"
          onClick={() => oublierStockageLocal(CLES_PARCOURS)}
          className="mt-2 text-sm font-medium text-zinc-400 underline underline-offset-2 transition hover:text-ink"
        >
          Tout recommencer
        </button>
      </div>
    );
  }

  /* ────────────────────────────────────────────────────── les questions ── */
  const ETAPES = [
    {
      section: "Ton compte",
      titre: "Une marque cherche d'abord un compte, pas un CV.",
      aide: "Colle le lien de ton profil principal — on en tire ton pseudo et ton réseau.",
      contenu: (
        <div>
          <div className="flex flex-wrap gap-2">
            {RESEAUX.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReseauChoisi(reseauChoisi === r ? null : r)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                  reseauChoisi === r
                    ? "border-transparent bg-ink text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
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
            className="mt-4 min-h-[58px] w-full rounded-2xl border border-zinc-200 px-5 text-base outline-none transition focus:border-ink"
          />
          {erreurLien && <p className="mt-2 text-sm text-red-600">{erreurLien}</p>}

          <button
            type="button"
            onClick={validerLien}
            disabled={!lien.trim()}
            className={`${BOUTON_PRINCIPAL} mt-4`}
          >
            Continuer
          </button>
        </div>
      ),
    },

    {
      section: "Ton compte",
      titre: "La taille d'une audience change ce qu'une marque peut proposer.",
      aide: "Une fourchette suffit — personne ne connaît son compte au millier près.",
      contenu: (
        <div className="grid gap-2.5">
          {TRANCHES_AUDIENCE.map((t) => (
            <Reponse
              key={t.id}
              actif={carte.audience === t.id}
              suffixe={t.palier}
              onClick={() => {
                maj({ audience: t.id as TrancheId });
                setEtape(2);
              }}
            >
              {t.label} abonnés
            </Reponse>
          ))}
        </div>
      ),
    },

    {
      section: "Ton contenu",
      titre: "Une marque de sport ne cherche pas dans la même liste qu'une marque de beauté.",
      aide: "Une ou deux suffisent. C'est ce qui te rend trouvable.",
      contenu: (
        <div>
          <div className="flex flex-wrap gap-2">
            {NICHES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => maj({ niches: basculer(carte.niches, n) })}
                className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold transition ${
                  carte.niches.includes(n)
                    ? "border-transparent bg-ink text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
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
            className={`${BOUTON_PRINCIPAL} mt-6`}
          >
            Continuer
          </button>
        </div>
      ),
    },

    {
      section: "Tes offres",
      titre: "Toutes les collaborations ne se ressemblent pas, et ne se paient pas pareil.",
      aide: "Coche tout ce que tu acceptes de faire. Tu pourras en retirer plus tard.",
      contenu: (
        <div className="grid gap-2.5">
          {OFFER_TYPES.map((o) => (
            <Reponse
              key={o.id}
              actif={carte.offres.includes(o.id as OfferId)}
              suffixe={o.tag}
              onClick={() => maj({ offres: basculer(carte.offres, o.id as OfferId) })}
            >
              {o.emoji} {o.label}
            </Reponse>
          ))}

          {/* L'échappatoire est une RÉPONSE, au milieu des autres — pas un lien
              gris en bas de page. C'est ici qu'elle a un sens : quelqu'un qui
              découvre ne sait pas encore ce qu'il peut vendre. On l'envoie
              comprendre, pas dehors. */}
          <Link
            href="/decouvrir"
            className="flex min-h-[60px] w-full items-center rounded-2xl border border-dashed border-zinc-200 px-5 py-4 text-[15px] font-semibold text-zinc-500 transition hover:border-zinc-400 hover:text-ink"
          >
            Je ne sais pas encore ce que je peux proposer
          </Link>

          <button
            type="button"
            onClick={() => setEtape(4)}
            disabled={carte.offres.length === 0}
            className={`${BOUTON_PRINCIPAL} mt-3`}
          >
            Continuer
          </button>
        </div>
      ),
    },

    {
      section: "Tes offres",
      titre: "Un tarif affiché t'évite les propositions à 20 €.",
      aide: "Ton prix d'entrée, pour la prestation la plus simple.",
      contenu: (
        <div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={carte.prixMini ?? ""}
              onChange={(e) =>
                maj({ prixMini: e.target.value === "" ? null : Number(e.target.value) })
              }
              placeholder="220"
              className="min-h-[58px] w-full rounded-2xl border border-zinc-200 px-5 text-2xl font-bold tabular-nums outline-none transition focus:border-ink"
            />
            <span className="text-2xl font-bold text-zinc-300">€</span>
          </div>

          {/* Repères sourcés plutôt qu'une fourchette inventée : ce sont ceux
              de `REPERES_MARCHE`, relevés et datés. */}
          <p className="mt-4 rounded-2xl bg-zinc-50 p-4 text-[13px] leading-relaxed text-zinc-500">
            <strong className="font-semibold text-zinc-700">
              Tu ne sais pas quoi mettre&nbsp;?
            </strong>{" "}
            Le prix moyen constaté en France pour une vidéo UGC de 30 secondes est
            de 28 €, et les plateformes affichent une entrée de gamme à partir de
            80 €. À toi de te situer.
          </p>

          <button
            type="button"
            onClick={() => setRevelee(true)}
            disabled={carte.prixMini === null}
            className={`${BOUTON_PRINCIPAL} mt-5`}
          >
            Voir ma carte
          </button>
        </div>
      ),
    },
  ];

  const courante = ETAPES[etape];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-5 py-8 sm:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
        {courante.section}
      </p>

      <h1 className="font-display mt-3 text-[26px] font-black leading-[1.12] tracking-tight text-ink sm:text-[34px]">
        {courante.titre}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-zinc-500 sm:text-base">
        {courante.aide}
      </p>

      <div className="mt-8">{courante.contenu}</div>

      {etape > 0 ? (
        <button
          type="button"
          onClick={() => setEtape(etape - 1)}
          className="mt-8 self-start text-sm font-medium text-zinc-400 transition hover:text-ink"
        >
          ← Retour
        </button>
      ) : (
        /* À la première question il n'y a pas de retour — mais quelqu'un qui
           s'est trompé de côté doit pouvoir en sortir, sinon il est coincé
           dans le mauvais questionnaire sans aucune issue. */
        <button
          type="button"
          onClick={() => oublierStockageLocal([CLE_COTE])}
          className="mt-8 self-start text-sm font-medium text-zinc-400 transition hover:text-ink"
        >
          ← Je ne suis pas créateur
        </button>
      )}
    </div>
  );
}
