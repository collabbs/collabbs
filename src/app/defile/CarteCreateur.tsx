"use client";

import PlatformIcon from "@/components/PlatformIcon";
import { OFFER_BY_ID } from "@/components/landing/creators";
import type { MarketplaceCreator } from "@/lib/creators-data";
import type { Direction } from "./CarteBrief";
import { useGesteDeCarte } from "./useGesteDeCarte";

/**
 * Une carte de créateur, pour le défilé côté marque.
 *
 * Contrairement au brief, on a ici une VRAIE photo : le créateur l'a
 * téléversée pour être visible. Elle occupe donc tout le cadre — c'est ce
 * qu'une marque regarde en premier, avant les chiffres.
 *
 * Le geste est le même que sur `CarteBrief` ; le commentaire de ce fichier-là
 * détaille les trois pièges du glissement.
 */


export default function CarteCreateur({
  createur,
  onDecision,
  onOuvrir,
  sortirVers,
  enArriere,
}: {
  createur: MarketplaceCreator;
  onDecision?: (d: Direction) => void;
  /** Pression simple, sans glissement : on ouvre la fiche détaillée. */
  onOuvrir?: () => void;
  /**
   * Sortie commandée de l'extérieur, par les boutons ♥ et ✕.
   *
   * Sans ça, les boutons faisaient avancer la pile SANS que la carte parte :
   * elle disparaissait d'un coup et on ne voyait pas de quel côté. Le geste
   * animait, le bouton non — deux comportements pour une même décision.
   */
  sortirVers?: Direction | null;
  enArriere?: boolean;
}) {
  // Le geste vit dans `useGesteDeCarte`, partagé avec la carte campagne.
  // Il en existait deux copies : les corrections — mouvement hors de React,
  // sortie qui accélère, effacement retardé — n'avaient été portées que sur
  // l'autre. Ce défilé accrochait donc depuis le début, et les cartes
  // s'évaporaient sur place au lieu de partir sur le côté.
  const geste = useGesteDeCarte({
    actif: !enArriere && sortirVers == null,
    onDecision,
    onOuvrir,
    sortirVers,
  });
  // Déstructuré : passer `geste.racine` en attribut fait croire à l'analyse
  // statique qu'on lit une référence pendant le rendu.
  const { racine, tamponOui, tamponNon, gestionnaires, transition, sortieEffective } =
    geste;
  const inerte = enArriere || sortieEffective !== null;

  const offres = createur.offers.map((id) => OFFER_BY_ID[id]).filter(Boolean).slice(0, 3);

  // React ne décrit que les états STABLES : la sortie, la carte du dessous,
  // le repos. Le mouvement du doigt s'écrit directement sur le nœud.
  const transform = sortieEffective
    ? `translateX(${sortieEffective === "droite" ? 900 : -900}px) rotate(${sortieEffective === "droite" ? 26 : -26}deg)`
    : enArriere
      ? "scale(0.95) translateY(10px)"
      : undefined;

  return (
    <div
      ref={racine}
      {...gestionnaires}
      style={{
        transform,
        transition,
        touchAction: "none",
        opacity: sortieEffective ? 0 : 1,
        // Prévient le navigateur : il prépare un calque, le geste ne repeint
        // plus la carte à chaque image.
        willChange: "transform",
      }}
      className={`absolute inset-0 select-none overflow-hidden rounded-[28px] bg-zinc-900 shadow-[0_20px_60px_-24px_rgba(0,0,0,.55)] ${
        enArriere ? "pointer-events-none" : ""
      } ${inerte ? "" : "cursor-grab active:cursor-grabbing"}`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${createur.photo}"), ${createur.tint}` }}
      />

      {!enArriere && (
        <>
          <span
            ref={tamponOui}
            style={{ opacity: sortirVers === "droite" ? 1 : 0 }}
            className="pointer-events-none absolute left-6 top-8 z-20 -rotate-[14deg] rounded-2xl border-4 border-emerald-400 px-4 py-1.5 text-xl font-black uppercase tracking-wider text-emerald-400"
          >
            Intéressé
          </span>
          <span
            ref={tamponNon}
            style={{ opacity: sortirVers === "gauche" ? 1 : 0 }}
            className="pointer-events-none absolute right-6 top-8 z-20 rotate-[14deg] rounded-2xl border-4 border-rose-400 px-4 py-1.5 text-xl font-black uppercase tracking-wider text-rose-400"
          >
            Passer
          </span>
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-28">
        <div className="flex items-center gap-2">
          <PlatformIcon slug={createur.platformSlug} className="h-4 w-4 text-white" />
          <span className="text-sm font-semibold text-white/80">{createur.followers}</span>
          {createur.engagement !== "—" && (
            <span className="text-sm text-white/50">· {createur.engagement} eng.</span>
          )}
        </div>

        <p className="mt-1.5 font-display text-4xl font-black leading-[1.05] tracking-tight text-white">
          {createur.name}
        </p>
        <p className="text-sm text-white/50">@{createur.handle}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {createur.niches.slice(0, 2).map((n) => (
            <span
              key={n}
              className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur"
            >
              {n}
            </span>
          ))}
          {offres.map((o) => (
            <span
              key={o.id}
              className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur"
            >
              {o.emoji} {o.short}
            </span>
          ))}
        </div>

        {createur.priceFrom !== null && (
          <p className="mt-4 font-display text-3xl font-black leading-none tabular-nums tracking-tight text-white">
            dès {createur.priceFrom.toLocaleString("fr-FR")} €
          </p>
        )}
      </div>
    </div>
  );
}
