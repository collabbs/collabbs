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

/** Le signe du format, en filigrane géant derrière le contenu. */
const SIGNE_TYPE: Record<string, string> = {
  video: "▶",
  ugc: "◉",
  affiliation: "↗",
  performance: "▲",
  hybrid: "◈",
  cpa_tiers: "≡",
};

/**
 * Une teinte par campagne, dérivée de son identifiant.
 *
 * Une marque n'a pas de logo dans le questionnaire — téléverser avant d'avoir
 * un compte fait abandonner. Un dégradé identique sur toutes les cartes donne
 * alors l'impression d'un gabarit vide. Deux campagnes n'ont donc jamais la
 * même couleur, et celle d'une campagne ne change jamais d'un chargement à
 * l'autre : une couleur aléatoire donnerait l'impression que rien n'est décidé.
 */
function teinte(graine: string): { h: number } {
  let somme = 0;
  for (let i = 0; i < graine.length; i++) somme = (somme * 31 + graine.charCodeAt(i)) % 360;
  return { h: somme };
}

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
  onOuvrir,
  sortirVers,
  /** Carte du dessous : visible mais inerte, elle donne l'épaisseur du paquet. */
  enArriere,
}: {
  brief: BriefDefile;
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
  const [dx, setDx] = useState(0);
  const [glisse, setGlisse] = useState(false);
  const [sortie, setSortie] = useState<Direction | null>(null);
  const depart = useRef(0);
  // Distingue une PRESSION d'un GLISSEMENT : sans ça, ouvrir la fiche au
  // toucher déclencherait aussi une décision, et inversement.
  const aBouge = useRef(false);

  const sortieEffective = sortie ?? sortirVers ?? null;
  const inerte = enArriere || sortieEffective !== null;

  function commencer(e: React.PointerEvent) {
    if (inerte || !onDecision) return;
    depart.current = e.clientX;
    aBouge.current = false;
    setGlisse(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* certains navigateurs refusent la capture : le geste marche quand même */
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
  const remuneration = remunerationLisible(brief);
  const { h } = teinte(brief.id);

  const transform = sortieEffective
    ? `translateX(${sortieEffective === "droite" ? 900 : -900}px) rotate(${sortieEffective === "droite" ? 26 : -26}deg)`
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
        opacity: sortieEffective ? 0 : 1,
      }}
      className={`absolute inset-0 select-none overflow-hidden rounded-[28px] shadow-[0_20px_60px_-24px_rgba(0,0,0,.55)] ${
        enArriere ? "pointer-events-none" : ""
      } ${inerte ? "" : "cursor-grab active:cursor-grabbing"}`}
    >
      {/* Fond plein cadre, propre à la campagne. Pas de logo à afficher : on
          dessine donc un objet qui tient sans image, plutôt que d'imiter une
          photo absente. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(150deg, hsl(${h} 62% 16%), hsl(${(h + 46) % 360} 72% 34%))`,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(130%_85%_at_18%_6%,rgba(255,255,255,.22),transparent_58%)]" />
      {/* Le signe du format, énorme et à peine visible : il donne de la matière
          au fond sans jamais concurrencer le texte. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 top-4 select-none text-[210px] font-black leading-none text-white/[0.07]"
      >
        {SIGNE_TYPE[brief.type] ?? "●"}
      </span>

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
