"use client";

import { useRef, useState } from "react";
import type { BriefDefile } from "@/lib/defile";

/**
 * Une carte du défilé — pleine hauteur, qu'on attrape et qu'on jette.
 *
 * ─── Ce qui change par rapport à la première version ───
 * Elle occupe tout l'écran. Une vignette avec des boutons rectangulaires en
 * dessous, c'est une liste déguisée : on lit, on compare, on hésite. Une carte
 * pleine hauteur ne laisse qu'une chose à faire — trancher — et c'est de là
 * que vient le rythme.
 *
 * ─── Pourquoi les évènements « pointeur » ───
 * `pointerdown/move/up` couvrent le doigt, la souris et le stylet avec le même
 * code. Deux chemins séparés finiraient par diverger.
 *
 * ─── Les trois pièges du glissement ───
 * 1. `touch-action: none` : sans lui le navigateur prend le mouvement pour un
 *    défilement de page et la carte reste collée pendant que l'écran bouge.
 * 2. `setPointerCapture` : le geste continue quand le doigt sort de la carte.
 * 3. Aucune transition PENDANT le glissement, sinon la carte suit le doigt
 *    avec du retard. Elle ne s'anime qu'au relâchement.
 */

const SEUIL = 100;

const LIBELLES_TYPE: Record<string, string> = {
  video: "Vidéo postée",
  ugc: "Contenu UGC",
  affiliation: "Affiliation",
  performance: "Performance",
  hybrid: "Fixe + commission",
  cpa_tiers: "Paliers",
};

export type Direction = "gauche" | "droite";

export function remunerationLisible(brief: BriefDefile) {
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
}

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
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* certains navigateurs refusent la capture : le geste marche quand même */
    }
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
      window.setTimeout(() => onDecision?.(dir), 240);
    } else {
      setDx(0);
    }
  }

  const rotation = Math.max(-16, Math.min(16, dx / 14));
  const intensite = Math.min(1, Math.abs(dx) / SEUIL);
  const remuneration = remunerationLisible(brief);

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
      className={`absolute inset-0 select-none overflow-hidden rounded-[28px] shadow-[0_20px_60px_-24px_rgba(0,0,0,.55)] ${
        enArriere ? "pointer-events-none" : ""
      } ${inerte ? "" : "cursor-grab active:cursor-grabbing"}`}
    >
      {/* Fond plein cadre. Pas de photo de marque demandée au questionnaire —
          téléverser un logo avant d'avoir un compte, c'est le moment où l'on
          abandonne. On dessine donc quelque chose qui tient sans image. */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-purple-950 to-fuchsia-950" />
      <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_15%_5%,rgba(168,85,247,.55),transparent_60%)]" />

      {/* Tampons de décision : ils disent ce qui va se passer AVANT de lâcher. */}
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

      {/* Le contenu vit en bas, sur un voile — comme un profil. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-6 pt-24">
        {brief.dejaInteressee && (
          <span className="mb-3 inline-block rounded-full bg-emerald-400 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-950">
            Cette marque t&apos;a repéré
          </span>
        )}

        <p className="font-display text-4xl font-black leading-[1.05] tracking-tight text-white">
          {brief.marque}
        </p>

        <span className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {LIBELLES_TYPE[brief.type] ?? brief.type}
        </span>

        {brief.produit && (
          <p className="mt-3 line-clamp-3 text-[15px] leading-snug text-white/80">
            {brief.produit}
          </p>
        )}

        {remuneration && (
          <p className="mt-4 font-display text-3xl font-black leading-none tabular-nums tracking-tight text-white">
            {remuneration.gros}
            <span className="ml-2 align-middle text-xs font-medium text-white/60">
              {remuneration.petit}
            </span>
          </p>
        )}

        {brief.spots !== null && (
          <p className="mt-2 text-[11px] font-medium text-white/50">
            {brief.spots} place{brief.spots > 1 ? "s" : ""} disponible
            {brief.spots > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
