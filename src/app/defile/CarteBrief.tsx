"use client";

import { useRef, useState } from "react";
import type { BriefDefile } from "@/lib/defile";
import { LIBELLES_TYPE } from "@/lib/collaboration";

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
      {/* ═══ LA DIRECTION ARTISTIQUE : UN BON DE COLLABORATION ═══

          Un dégradé avec un logo posé dessus n'est pas une identité, c'est un
          fond. Une identité, c'est une STRUCTURE qui revient : une grammaire
          qu'on reconnaît avant même de lire.

          La carte est donc traitée comme un ticket — un bon à prendre. Ça dit
          ce qu'elle est, et ça donne les éléments qui la rendent reconnaissable
          d'un coup d'œil dans une vidéo :

            · un rail en tête, avec le nom Collabbs en petites capitales
              espacées et une règle pointillée qui le traverse ;
            · une ENCOCHE de chaque côté, à la césure — le signe le plus
              identifiable d'un ticket, et celui qu'aucun concurrent n'a ;
            · une césure perforée qui sépare l'émetteur du montant ;
            · le chiffre traité comme un objet graphique, pas comme du texte :
              énorme, très resserré, calé sur la marge.

          Fond ENCRE PLEINE, pas de dégradé : un aplat franc se capture mieux
          et vieillit mieux. La couleur ne sert plus de décor, elle sert
          d'accent — un seul trait, celui du site de la marque. */}
      <div className="absolute inset-0 bg-ink" />

      {/* Trame fine en fond : de la matière, jamais du motif. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(255,255,255,.09) 0px, rgba(255,255,255,.09) 1px, transparent 1px, transparent 7px)",
        }}
      />

      {/* Halo sourd derrière le logo : une seule source de lumière. */}
      <div
        aria-hidden
        className="lueur-carte absolute left-1/2 top-[30%] h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle, rgba(168,85,247,.85) 0%, rgba(236,72,153,.35) 50%, transparent 72%)",
          filter: "blur(46px)",
        }}
      />

      {/* Tampons de décision : ils disent ce qui va se passer AVANT de lâcher.
          Supprimés par accident en réécrivant le fond — sans eux le geste perd
          son retour, et on lâche sans savoir de quel côté on va. */}
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

      {/* Voile bas : le texte reste lisible quelle que soit la teinte tirée. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent" />

      {/* ─── UNE AFFICHE, PAS UNE FICHE ───

          Le défilé n'est pas qu'une fonctionnalité : c'est ce qui se filme et
          se capture pour faire venir du monde. Une carte couverte de texte ne
          se partage pas.

          Tout ce qui se lit a donc été retiré : la description, le nombre de
          places, l'audience minimale, l'invitation à toucher. Ça n'est pas
          perdu — c'est dans la fiche, qui s'ouvre d'une pression, et qui
          existe précisément pour que la carte n'ait pas à tout porter.

          Il ne reste que ce qui se voit en une seconde : QUI, COMBIEN, QUOI. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {/* ── Le rail de tête ── */}
        <div className="flex items-center gap-3 px-6 pt-5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-white/50">
            Collabbs
          </span>
          <span
            className="h-px flex-1"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, rgba(255,255,255,.28) 0 3px, transparent 3px 7px)",
            }}
          />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-white/50">
            {LIBELLES_TYPE[brief.type] ?? brief.type}
          </span>
        </div>

        {/* ── L'émetteur ── */}
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          {brief.image ? (
            <span
              className="h-24 w-24 rounded-[22px] bg-white bg-contain bg-center bg-no-repeat shadow-[0_16px_44px_-12px_rgba(0,0,0,.8)]"
              style={{ backgroundImage: `url("${brief.image}")` }}
            />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-[22px] bg-white/10 font-display text-4xl font-black text-white ring-1 ring-white/15">
              {brief.marque.slice(0, 1).toUpperCase()}
            </span>
          )}
          <p className="mt-4 max-w-full truncate font-display text-[24px] font-black leading-tight tracking-tight text-white">
            {brief.marque}
          </p>
          {brief.dejaInteressee && (
            <span className="mt-3 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-950">
              T&apos;a repéré
            </span>
          )}
        </div>

        {/* ── La césure, avec ses encoches ──
            Les encoches étaient posées à une hauteur devinée (47 %) et ne
            tombaient donc jamais sur la césure. Elles vivent maintenant DANS
            la même rangée : elles suivent, quelle que soit la hauteur de
            l'écran. C'est le signe le plus reconnaissable de la carte, il ne
            peut pas flotter à côté du trait qu'il est censé marquer. */}
        <div aria-hidden className="relative mx-6 h-px">
          <span className="absolute -left-9 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white" />
          <span className="absolute -right-9 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white" />
          <span
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, rgba(255,255,255,.35) 0 5px, transparent 5px 11px)",
            }}
          />
        </div>

        {/* ── Le talon : ce qu'on gagne ── */}
        <div className="px-6 pb-6 pt-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-1 w-10 shrink-0 rounded-full"
              style={{ background: brief.couleurMarque ?? "rgb(168,85,247)" }}
            />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">
              Tu gagnes
            </span>
          </div>

          {remuneration ? (
            <>
              {/* Le qualificatif SOUS le chiffre, pas en exposant : « de
                  commission » se coupait en deux, « de » collé au nombre et
                  « commission » rejeté à la ligne. */}
              <p className="font-display mt-2 text-[66px] font-black leading-[0.82] tracking-[-0.05em] text-white [overflow-wrap:anywhere]">
                {remuneration.gros}
              </p>
              <p className="mt-2 text-[14px] font-bold text-white/55">{remuneration.petit}</p>
            </>
          ) : (
            <p className="font-display mt-2 text-[40px] font-black leading-none tracking-tight text-white/70">
              À négocier
            </p>
          )}

          {brief.titre && (
            <p className="mt-4 line-clamp-2 text-[16px] font-semibold leading-snug text-white/85">
              {brief.titre}
            </p>
          )}

          {brief.niches.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              {brief.niches.slice(0, 3).map((n) => (
                <span
                  key={n}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/55"
                >
                  · {n}
                </span>
              ))}
            </div>
          )}

          {/* Le trait de la marque : sa couleur, en accent, et rien de plus.
              Remonté au-dessus du talon — en bas de carte il se faisait rogner
              par le rayon de l'angle. */}
        </div>
      </div>

    </div>
  );
}
