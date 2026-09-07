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
  // Une photo par campagne, toujours la même : on tire dans la liste à partir
  // de l'identifiant plutôt qu'au hasard. Une carte qui change d'image d'un
  // chargement à l'autre donne l'impression que rien n'est décidé.
  const photo =
    brief.photos.length > 0
      ? brief.photos[
          [...brief.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7) %
            brief.photos.length
        ]
      : null;

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
      {/* ═══ LA PHOTO D'ABORD ═══

          Toutes mes tentatives précédentes arrangeaient du TEXTE sur un
          rectangle : dégradé, ticket, encoches, typographie. Aucune ne pouvait
          accrocher l'œil, parce qu'il n'y avait rien à regarder — ni humain,
          ni matière, ni produit.

          Les boutiques Shopify publient leurs fiches produit ouvertement
          (`/products.json`). On y trouve de vraies photos : des gens qui
          portent le vêtement, tiennent l'objet. C'est ça qui fait s'arrêter
          dans un fil, pas une mise en page.

          La photo occupe donc TOUTE la carte. Le reste — logo, montant,
          mission — se pose dessus, sur un voile. Quand aucune photo n'existe,
          on retombe sur le traitement graphique, qui redevient ce qu'il aurait
          toujours dû être : un repli, pas une ambition. */}
      {photo ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${photo}")` }}
          />
          {/* Deux voiles : un léger partout pour que le blanc tienne, un franc
              en bas où vit le texte. */}
          <div className="absolute inset-0 bg-black/15" />
          <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black via-black/70 to-transparent" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-ink" />
          <div
            aria-hidden
            className="lueur-carte absolute left-1/2 top-[32%] h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
            style={{
              background:
                "radial-gradient(circle, rgba(168,85,247,.85) 0%, rgba(236,72,153,.35) 50%, transparent 72%)",
              filter: "blur(46px)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black via-black/60 to-transparent" />
        </>
      )}

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
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5">
        {/* Le logo en haut, petit : il identifie, il n'occupe plus la carte. */}
        <div className="flex items-center gap-2.5">
          {brief.image ? (
            <span
              className="h-11 w-11 shrink-0 rounded-xl bg-white bg-contain bg-center bg-no-repeat shadow-[0_4px_16px_-4px_rgba(0,0,0,.6)]"
              style={{ backgroundImage: `url("${brief.image}")` }}
            />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 font-display text-lg font-black text-white backdrop-blur">
              {brief.marque.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="font-display truncate text-[18px] font-black tracking-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,.6)]">
            {brief.marque}
          </span>
          {brief.dejaInteressee && (
            <span className="ml-auto shrink-0 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-950">
              T&apos;a repéré
            </span>
          )}
        </div>

        {/* Le montant, posé sur la photo. */}
        <div>
          {remuneration ? (
            <>
              <p className="font-display text-[62px] font-black leading-[0.85] tracking-[-0.05em] text-white [text-shadow:0_4px_24px_rgba(0,0,0,.7)] [overflow-wrap:anywhere]">
                {remuneration.gros}
              </p>
              <p className="mt-1 text-[14px] font-bold text-white/75">{remuneration.petit}</p>
            </>
          ) : (
            <p className="font-display text-[38px] font-black leading-none tracking-tight text-white/80">
              À négocier
            </p>
          )}

          {brief.titre && (
            <p className="mt-3 line-clamp-2 text-[16px] font-semibold leading-snug text-white/90">
              {brief.titre}
            </p>
          )}

          {brief.niches.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {brief.niches.slice(0, 3).map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur"
                >
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
