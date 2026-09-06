"use client";

import { useRef, useState } from "react";
import PlatformIcon from "@/components/PlatformIcon";
import { OFFER_BY_ID } from "@/components/landing/creators";
import type { MarketplaceCreator } from "@/lib/creators-data";
import type { Direction } from "./CarteBrief";

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

const SEUIL = 100;

export default function CarteCreateur({
  createur,
  onDecision,
  onOuvrir,
  enArriere,
}: {
  createur: MarketplaceCreator;
  onDecision?: (d: Direction) => void;
  /** Pression simple, sans glissement : on ouvre la fiche détaillée. */
  onOuvrir?: () => void;
  enArriere?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [glisse, setGlisse] = useState(false);
  const [sortie, setSortie] = useState<Direction | null>(null);
  const depart = useRef(0);
  // Distingue une PRESSION d'un GLISSEMENT : sans ça, ouvrir la fiche au
  // toucher déclencherait aussi une décision, et inversement.
  const aBouge = useRef(false);

  const inerte = enArriere || sortie !== null;

  function commencer(e: React.PointerEvent) {
    if (inerte || !onDecision) return;
    depart.current = e.clientX;
    aBouge.current = false;
    setGlisse(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture refusée : le geste marche quand même */
    }
  }

  function bouger(e: React.PointerEvent) {
    if (!glisse) return;
    const ecart = e.clientX - depart.current;
    // 6 px de tolérance : un doigt n'est jamais parfaitement immobile, et sans
    // cette marge une pression normale passerait pour un micro-glissement.
    if (Math.abs(ecart) > 6) aBouge.current = true;
    setDx(ecart);
  }

  function relacher() {
    if (!glisse) return;
    setGlisse(false);
    if (!aBouge.current) {
      setDx(0);
      onOuvrir?.();
      return;
    }
    if (Math.abs(dx) >= SEUIL) {
      const dir: Direction = dx > 0 ? "droite" : "gauche";
      setSortie(dir);
      window.setTimeout(() => onDecision?.(dir), 240);
    } else {
      setDx(0);
    }
  }

  const rotation = Math.max(-16, Math.min(16, dx / 14));
  const intensite = Math.min(1, Math.abs(dx) / SEUIL);
  const offres = createur.offers.map((id) => OFFER_BY_ID[id]).filter(Boolean).slice(0, 3);

  const transform = sortie
    ? `translateX(${sortie === "droite" ? 900 : -900}px) rotate(${sortie === "droite" ? 26 : -26}deg)`
    : enArriere
      ? "scale(0.95) translateY(10px)"
      : `translateX(${dx}px) rotate(${rotation}deg)`;

  return (
    <div
      onPointerDown={commencer}
      onPointerMove={bouger}
      onPointerUp={relacher}
      onPointerCancel={relacher}
      style={{
        transform,
        transition: glisse ? "none" : "transform .24s cubic-bezier(.22,.61,.36,1), opacity .2s",
        touchAction: "none",
        opacity: sortie ? 0 : 1,
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
            style={{ opacity: dx > 0 ? intensite : 0 }}
            className="pointer-events-none absolute left-6 top-8 z-20 -rotate-[14deg] rounded-2xl border-4 border-emerald-400 px-4 py-1.5 text-xl font-black uppercase tracking-wider text-emerald-400"
          >
            Intéressé
          </span>
          <span
            style={{ opacity: dx < 0 ? intensite : 0 }}
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
