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
      {/* ─── Le fond, en trois couches ───

          Une couleur plate ne fait pas vivre une carte, et un créateur qui
          fait défiler vit ça comme une chance de gagner de l'argent : il faut
          que ça respire.

          1. La teinte, comme base — celle du site de la marque si elle en
             déclare une, sinon celle de la campagne.
          2. L'image de la marque, FLOUTÉE et agrandie. Le flou règle d'un coup
             le problème du recadrage : une image de partage est un bandeau
             large, illisible en portrait — mais floutée à 40 px, son cadrage
             n'a plus aucune importance, et il en reste les couleurs et la
             matière. C'est ce que font les lecteurs de musique derrière une
             pochette.
          3. Un grain fin. C'est LUI qui fait la différence entre un aplat qui
             fait bon marché et une surface. Généré en SVG, aucun fichier à
             charger. */}
      <div
        className="absolute inset-0"
        style={{
          background: brief.couleurMarque
            ? `linear-gradient(160deg, ${brief.couleurMarque}, hsl(${(h + 40) % 360} 62% 34%))`
            : `linear-gradient(160deg, hsl(${h} 60% 24%), hsl(${(h + 40) % 360} 68% 46%))`,
        }}
      />

      {/* ⚠️ En FUSION, pas en superposition.
          Posée par-dessus à 60 % d'opacité, l'image floutée écrasait la
          couleur : un logo noir et blanc flouté donne de la bouillie grise, et
          le bleu-vert de Gymshark disparaissait. Le flou marche pour une
          photo, pas pour un logo — et on ne peut pas distinguer les deux à
          l'avance. En `soft-light`, l'image apporte ses variations sans
          remplacer la teinte : les photos donnent de la matière, les logos ne
          font plus qu'un dégradé de lumière. */}
      {brief.image && (
        <div
          className="absolute -inset-16 bg-cover bg-center opacity-70 mix-blend-soft-light"
          style={{
            backgroundImage: `url("${brief.image}")`,
            filter: "blur(44px) saturate(1.8)",
          }}
        />
      )}

      {/* Halo qui dérive lentement. Une couleur immobile reste un aplat ; une
          couleur qui respire donne une surface. Voir `.lueur-carte`, coupée
          pour qui a demandé moins d'animations. */}
      <div
        aria-hidden
        className="lueur-carte absolute inset-0 bg-[radial-gradient(60%_45%_at_30%_18%,rgba(255,255,255,.34),transparent_70%)]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_55%_at_80%_5%,rgba(255,255,255,.14),transparent_60%)]" />

      {/* Grain. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")",
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
      <div className="pointer-events-none absolute inset-0 flex flex-col p-6">
        {/* Qui. */}
        <div className="flex items-center gap-3">
          {brief.image ? (
            <span
              className="h-14 w-14 shrink-0 rounded-2xl bg-white bg-contain bg-center bg-no-repeat shadow-[0_6px_18px_-4px_rgba(0,0,0,.55)] ring-1 ring-white/50"
              style={{ backgroundImage: `url("${brief.image}")` }}
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 font-display text-2xl font-black text-white backdrop-blur">
              {brief.marque.slice(0, 1).toUpperCase()}
            </span>
          )}
          <p className="min-w-0 truncate font-display text-[22px] font-black leading-tight tracking-tight text-white">
            {brief.marque}
          </p>
          {brief.dejaInteressee && (
            <span className="ml-auto shrink-0 rounded-full bg-emerald-400 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-950">
              T&apos;a repéré
            </span>
          )}
        </div>

        {/* Combien. Le chiffre est l'image de la carte : c'est lui qu'on
            capture, c'est lui qui donne envie. */}
        <div className="flex flex-1 flex-col justify-end">
          {remuneration ? (
            <>
              <p className="font-display text-[76px] font-black leading-[0.85] tracking-[-0.045em] text-white [text-shadow:0_6px_30px_rgba(0,0,0,.4)] [overflow-wrap:anywhere]">
                {remuneration.gros}
              </p>
              <p className="mt-2 text-[16px] font-bold text-white/75">{remuneration.petit}</p>
            </>
          ) : (
            <p className="font-display text-[44px] font-black leading-none tracking-tight text-white/75">
              À négocier
            </p>
          )}

          {/* Quoi. Une ligne, jamais deux. */}
          {brief.titre && (
            <p className="mt-5 line-clamp-2 text-[18px] font-semibold leading-snug text-white/90">
              {brief.titre}
            </p>
          )}

          {brief.niches.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {brief.niches.slice(0, 3).map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white/90 backdrop-blur"
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
