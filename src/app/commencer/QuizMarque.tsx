"use client";

import { useState } from "react";
import Link from "next/link";
import { useStockageLocal, oublierStockageLocal } from "@/hooks/useStockageLocal";
import { OFFER_TYPES, type OfferId } from "@/components/landing/creators";
import CarteBriefApercu from "./CarteBriefApercu";
import {
  CLES_PARCOURS,
  CLE_COTE,
  CLE_BRIEF,
  MODES_REMUNERATION,
  avancementMarque,
  carteMarqueVide,
  premiereEtapeIncompleteMarque,
  type CarteMarque,
  type ModeRemunerationId,
} from "@/lib/quiz";

/**
 * Le questionnaire marque.
 *
 * Mêmes règles visuelles que le côté créateur — voir `QuizCreateur` pour le
 * détail : le titre affirme au lieu d'interroger, l'échappatoire est une
 * réponse parmi les autres, pas de barre de progression, et rien à l'écran
 * que la question. La carte arrive à la fin, en récompense.
 *
 * Quatre questions au lieu de cinq, et c'est délibéré. Un créateur remplit son
 * profil : c'est un investissement qu'il fait une fois et qui le sert
 * longtemps. Une marque écrit une demande — elle veut le résultat, pas le
 * formulaire. Chaque question de trop est un abandon.
 */

const BOUTON_PRINCIPAL =
  "min-h-[58px] w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-base font-bold text-white transition hover:opacity-90 disabled:opacity-30";

const CHAMP =
  "min-h-[58px] w-full rounded-2xl border border-zinc-200 px-5 text-base outline-none transition focus:border-ink";

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

export default function QuizMarque() {
  const [carte, setCarte] = useStockageLocal<CarteMarque>(CLE_BRIEF, carteMarqueVide());
  const [etapeChoisie, setEtapeChoisie] = useState<number | null>(null);
  const [revelee, setRevelee] = useState(false);

  const etape = etapeChoisie ?? premiereEtapeIncompleteMarque(carte);
  const setEtape = setEtapeChoisie;
  const avancement = avancementMarque(carte);
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
  const maj = (patch: Partial<CarteMarque>) => {
    setEtapeChoisie((precedente) => precedente ?? etape);
    setCarte((p) => ({ ...p, ...patch }));
  };

  const briefComplet = avancement.pourcentage === 100 && Boolean(carte.echeance);
  const veutFixe = carte.remuneration === "fixe" || carte.remuneration === "les-deux";
  const veutCommission = carte.remuneration === "commission" || carte.remuneration === "les-deux";

  function basculer(liste: OfferId[], valeur: OfferId): OfferId[] {
    return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
  }

  /* ─────────────────────────────────── le brief, en récompense de fin ───── */
  if (revelee || (briefComplet && etapeChoisie === null)) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center px-5 py-10 text-center sm:py-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Ton brief
        </p>
        <h1 className="font-display mt-3 text-[26px] font-black leading-[1.12] tracking-tight text-ink sm:text-4xl">
          Voilà ce que les créateurs verront.
        </h1>

        <div className="mt-8 w-full max-w-[280px]">
          <CarteBriefApercu carte={carte} />
        </div>

        {/* Même règle que côté créateur : on ne demande pas de compte à
            quelqu'un qui vient de fournir un effort. On lui montre ce pour
            quoi il est venu — des créateurs. */}
        <p className="mt-6 text-[15px] leading-relaxed text-zinc-500">
          Voyons maintenant qui pourrait le porter.
        </p>
        <Link
          href="/creators"
          className={`${BOUTON_PRINCIPAL} mt-5 flex items-center justify-center`}
        >
          Voir les créateurs
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
      section: "Ta marque",
      titre: "Un créateur lit ce que tu vends avant de regarder ton budget.",
      aide: "En une ligne chacun. C'est ce qui s'affichera en haut de ta carte.",
      contenu: (
        <div className="grid gap-3">
          <input
            type="text"
            value={carte.nom ?? ""}
            onChange={(e) => maj({ nom: e.target.value || null })}
            placeholder="Lumi Cosmetics"
            className={CHAMP}
          />
          <input
            type="text"
            value={carte.produit ?? ""}
            onChange={(e) => maj({ produit: e.target.value || null })}
            placeholder="Des soins visage bio, fabriqués en France"
            className={CHAMP}
          />
          <button
            type="button"
            onClick={() => setEtape(1)}
            disabled={!carte.nom || !carte.produit}
            className={`${BOUTON_PRINCIPAL} mt-1`}
          >
            Continuer
          </button>
        </div>
      ),
    },

    {
      section: "Ta demande",
      titre: "Le format décide du prix, et du type de créateur qui répondra.",
      aide: "Plusieurs possibles. Tu affineras ensuite avec le créateur.",
      contenu: (
        <div className="grid gap-2.5">
          {OFFER_TYPES.map((o) => (
            <Reponse
              key={o.id}
              actif={carte.formats.includes(o.id as OfferId)}
              suffixe={o.tag}
              onClick={() => maj({ formats: basculer(carte.formats, o.id as OfferId) })}
            >
              {o.emoji} {o.label}
            </Reponse>
          ))}

          {/* Le point où une marque bloque vraiment : elle veut des créateurs
              mais n'a pas encore d'idée de campagne. On l'envoie comprendre ce
              que Collabbs sait faire, pas dehors. */}
          <Link
            href="/decouvrir"
            className="flex min-h-[60px] w-full items-center rounded-2xl border border-dashed border-zinc-200 px-5 py-4 text-[15px] font-semibold text-zinc-500 transition hover:border-zinc-400 hover:text-ink"
          >
            Je n&apos;ai pas encore d&apos;idée de campagne
          </Link>

          <button
            type="button"
            onClick={() => setEtape(2)}
            disabled={carte.formats.length === 0}
            className={`${BOUTON_PRINCIPAL} mt-3`}
          >
            Continuer
          </button>
        </div>
      ),
    },

    {
      section: "Ta demande",
      titre: "Un montant clair fait la différence entre un brief qu'on lit et un brief qu'on passe.",
      aide: "Les créateurs filtrent d'abord sur la rémunération.",
      contenu: (
        <div>
          <div className="grid gap-2.5">
            {MODES_REMUNERATION.map((m) => (
              <Reponse
                key={m.id}
                actif={carte.remuneration === m.id}
                onClick={() => maj({ remuneration: m.id as ModeRemunerationId })}
              >
                {m.label}
              </Reponse>
            ))}
          </div>

          {carte.remuneration && (
            <div className="mt-5 grid gap-4">
              {veutFixe && (
                <label className="block">
                  <span className="text-sm font-medium text-zinc-600">Montant par créateur</span>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={carte.montant ?? ""}
                      onChange={(e) =>
                        maj({ montant: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      placeholder="400"
                      className={`${CHAMP} text-2xl font-bold tabular-nums`}
                    />
                    <span className="text-2xl font-bold text-zinc-300">€</span>
                  </div>
                </label>
              )}
              {veutCommission && (
                <label className="block">
                  <span className="text-sm font-medium text-zinc-600">
                    Commission sur les ventes
                  </span>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={carte.commission ?? ""}
                      onChange={(e) =>
                        maj({ commission: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      placeholder="8"
                      className={`${CHAMP} text-2xl font-bold tabular-nums`}
                    />
                    <span className="text-2xl font-bold text-zinc-300">%</span>
                  </div>
                </label>
              )}
              <button
                type="button"
                onClick={() => setEtape(3)}
                disabled={carte.montant === null && carte.commission === null}
                className={BOUTON_PRINCIPAL}
              >
                Continuer
              </button>
            </div>
          )}
        </div>
      ),
    },

    {
      section: "Ta demande",
      titre: "Un brief sans date ne se traite jamais.",
      aide: "Même approximative. Elle dit au créateur s'il peut s'engager.",
      contenu: (
        <div>
          <input
            type="date"
            value={carte.echeance ?? ""}
            onChange={(e) => maj({ echeance: e.target.value || null })}
            className={CHAMP}
          />
          <button
            type="button"
            onClick={() => setRevelee(true)}
            disabled={!carte.echeance}
            className={`${BOUTON_PRINCIPAL} mt-5`}
          >
            Voir mon brief
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
          ← Je ne suis pas une marque
        </button>
      )}
    </div>
  );
}
