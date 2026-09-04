"use client";

import { useRef, useState } from "react";
import type { BriefDefile } from "@/lib/defile";

/**
 * Une carte du défilé, qu'on attrape et qu'on jette.
 *
 * ─── Pourquoi les évènements « pointeur » ───
 * `pointerdown/move/up` couvrent le doigt, la souris et le stylet avec le même
 * code. Écrire un chemin tactile et un chemin souris séparés, c'est garantir
 * que l'un des deux finira par diverger.
 *
 * ─── Les deux pièges du glissement ───
 * 1. `touch-action: none` est indispensable : sans lui, le navigateur
 *    interprète le mouvement comme un défilement de page et la carte reste
 *    collée pendant que l'écran bouge.
 * 2. `setPointerCapture` garde l'évènement même quand le doigt sort de la
 *    carte — sinon un geste ample se termine dans le vide et la carte reste
 *    en plan au milieu de l'écran.
 *
 * ─── Le seuil ───
 * En dessous, la carte revient à sa place : un geste hésitant ne doit rien
 * décider. Au-dessus, elle part — et on la laisse sortir de l'écran avant de
 * passer à la suivante, sinon le mouvement paraît interrompu.
 */

const SEUIL = 96;
const LIBELLES_TYPE: Record<string, string> = {
  video: "Vidéo postée",
  ugc: "Contenu UGC",
  affiliation: "Affiliation",
  performance: "Performance",
  hybrid: "Fixe + commission",
  cpa_tiers: "Paliers",
};

export type Direction = "gauche" | "droite";

export default function CarteBrief({
  brief,
  onDecision,
  /** Carte du dessous : visible mais inerte, elle donne l'épaisseur du paquet. */
  enArriere,
}: {
  brief: BriefDefile;
  onDecision?: (d: Direction) => void;
  enArriere?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [glisse, setGlisse] = useState(false);
  const [sortie, setSortie] = useState<Direction | null>(null);
  const depart = useRef(0);

  const inerte = enArriere || sortie !== null;

  function commencer(e: React.PointerEvent) {
    if (inerte || !onDecision) return;
    depart.current = e.clientX;
    setGlisse(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function bouger(e: React.PointerEvent) {
    if (!glisse) return;
    setDx(e.clientX - depart.current);
  }

  function relacher() {
    if (!glisse) return;
    setGlisse(false);
    if (Math.abs(dx) >= SEUIL) {
      const dir: Direction = dx > 0 ? "droite" : "gauche";
      setSortie(dir);
      // On laisse la carte quitter l'écran avant de passer à la suivante :
      // remplacer l'image au moment du lâcher donne un à-coup.
      window.setTimeout(() => onDecision?.(dir), 260);
    } else {
      setDx(0);
    }
  }

  const rotation = Math.max(-14, Math.min(14, dx / 16));
  const intensite = Math.min(1, Math.abs(dx) / SEUIL);

  const transform = sortie
    ? `translateX(${sortie === "droite" ? 700 : -700}px) rotate(${sortie === "droite" ? 22 : -22}deg)`
    : enArriere
      ? "scale(0.94) translateY(14px)"
      : `translateX(${dx}px) rotate(${rotation}deg)`;

  const remuneration = (() => {
    const c = brief.commission;
    const taux = c ? (c.min === c.max ? `${c.min} %` : `${c.min}–${c.max} %`) : null;
    if (brief.montant !== null && taux) {
      return { gros: `${brief.montant.toLocaleString("fr-FR")} €`, petit: `+ ${taux} sur les ventes` };
    }
    if (brief.montant !== null) {
      return { gros: `${brief.montant.toLocaleString("fr-FR")} €`, petit: "par créateur" };
    }
    if (taux) return { gros: taux, petit: "de commission" };
    return null;
  })();

  return (
    <div
      onPointerDown={commencer}
      onPointerMove={bouger}
      onPointerUp={relacher}
      onPointerCancel={relacher}
      style={{
        transform,
        // Pas de transition pendant le glissement : la carte doit coller au
        // doigt, pas le suivre avec du retard.
        transition: glisse ? "none" : "transform .26s cubic-bezier(.22,.61,.36,1)",
        touchAction: "none",
        opacity: sortie ? 0 : 1,
      }}
      className={`${
        enArriere ? "pointer-events-none absolute inset-0" : "relative"
      } select-none rounded-3xl border border-zinc-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,.04),0_24px_48px_-28px_rgba(0,0,0,.35)] ${
        inerte ? "" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      {/* Tampons de décision : ils apparaissent à mesure du geste, ce qui dit
          ce qui va se passer AVANT de lâcher. */}
      {!enArriere && (
        <>
          <span
            style={{ opacity: dx > 0 ? intensite : 0 }}
            className="pointer-events-none absolute left-6 top-6 z-10 -rotate-12 rounded-xl border-[3px] border-emerald-500 px-3 py-1 text-sm font-black uppercase tracking-wider text-emerald-500"
          >
            Intéressé
          </span>
          <span
            style={{ opacity: dx < 0 ? intensite : 0 }}
            className="pointer-events-none absolute right-6 top-6 z-10 rotate-12 rounded-xl border-[3px] border-zinc-400 px-3 py-1 text-sm font-black uppercase tracking-wider text-zinc-400"
          >
            Passer
          </span>
        </>
      )}

      <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-purple-950 to-zinc-900 px-6">
        <p className="pointer-events-none text-center font-display text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
          {brief.marque}
        </p>
      </div>

      <div className="px-2 pb-2 pt-4">
        <span className="inline-block rounded-full bg-purple-50 px-3 py-1 text-[11px] font-semibold text-purple-700">
          {LIBELLES_TYPE[brief.type] ?? brief.type}
        </span>

        {brief.produit && (
          <p className="mt-3 text-[15px] font-semibold leading-snug text-ink">{brief.produit}</p>
        )}

        {remuneration && (
          <p className="mt-4 font-display text-3xl font-black leading-none tabular-nums tracking-tight text-ink">
            {remuneration.gros}
            <span className="ml-2 align-middle text-xs font-medium text-zinc-500">
              {remuneration.petit}
            </span>
          </p>
        )}

        {brief.spots !== null && (
          <p className="mt-2 text-[11px] font-medium text-zinc-400">
            {brief.spots} place{brief.spots > 1 ? "s" : ""} sur cette campagne
          </p>
        )}
      </div>
    </div>
  );
}
