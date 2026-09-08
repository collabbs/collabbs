"use client";

import { useRef, useState } from "react";

/**
 * Le geste d'une carte qu'on attrape et qu'on jette.
 *
 * ─── Pourquoi un endroit partagé ───
 * Il existait en DEUX exemplaires : un dans la carte campagne, un dans la
 * carte créateur. Les corrections — sortir le mouvement de React, faire
 * accélérer la sortie, retarder l'effacement — n'ont été portées que sur le
 * premier. Le côté marque a donc gardé pendant tout ce temps un défilé qui
 * accroche et des cartes qui s'évaporent sur place, sans que personne le voie.
 *
 * Deux copies d'un même comportement divergent toujours ; la seule question
 * est laquelle des deux sera oubliée.
 *
 * ─── Les quatre pièges du glissement ───
 * 1. `touch-action: none` : sans lui, le navigateur prend le mouvement pour un
 *    défilement de page et la carte reste collée pendant que l'écran bouge.
 * 2. `setPointerCapture` : le geste continue quand le doigt sort de la carte.
 * 3. Aucune transition PENDANT le glissement, sinon la carte suit avec retard.
 * 4. Le décalage ne passe pas par React. Un état, c'est un rendu complet par
 *    pixel parcouru — quatre calques de dégradé à soixante images par seconde.
 *    Le mouvement s'écrit directement sur le nœud du DOM.
 */

export const SEUIL = 100;

export type Direction = "gauche" | "droite";

export function useGesteDeCarte({
  actif,
  onDecision,
  onOuvrir,
  sortirVers,
}: {
  /** Faux pour la carte du dessous : visible, mais inerte. */
  actif: boolean;
  onDecision?: (d: Direction) => void;
  onOuvrir?: () => void;
  sortirVers?: Direction | null;
}) {
  const [glisse, setGlisse] = useState(false);
  const [sortie, setSortie] = useState<Direction | null>(null);

  const racine = useRef<HTMLDivElement>(null);
  const tamponOui = useRef<HTMLSpanElement>(null);
  const tamponNon = useRef<HTMLSpanElement>(null);
  const depart = useRef(0);
  const dx = useRef(0);
  /* Le geste ne peut pas dépendre d'un état React : entre l'appui et le
     relâchement, sur un tap rapide, React n'a pas encore validé le changement.
     Une référence est à jour immédiatement. */
  const enCours = useRef(false);
  /* Distingue une PRESSION d'un GLISSEMENT : sans ça, ouvrir la fiche au
     toucher déclencherait aussi une décision, et inversement. */
  const aBouge = useRef(false);

  const sortieEffective = sortie ?? sortirVers ?? null;

  /** Écrit la position du doigt sur la carte, sans passer par un rendu. */
  function peindre(ecart: number) {
    const el = racine.current;
    if (!el) return;
    const rotation = Math.max(-16, Math.min(16, ecart / 14));
    el.style.transform = `translateX(${ecart}px) rotate(${rotation}deg)`;
    const intensite = Math.min(1, Math.abs(ecart) / SEUIL);
    if (tamponOui.current) tamponOui.current.style.opacity = String(ecart > 0 ? intensite : 0);
    if (tamponNon.current) tamponNon.current.style.opacity = String(ecart < 0 ? intensite : 0);
  }

  function commencer(e: React.PointerEvent) {
    if (!actif || !onDecision) return;
    depart.current = e.clientX;
    dx.current = 0;
    aBouge.current = false;
    enCours.current = true;
    setGlisse(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* certains navigateurs refusent la capture : le geste marche quand même */
    }
  }

  function bouger(e: React.PointerEvent) {
    if (!enCours.current) return;
    const ecart = e.clientX - depart.current;
    // 6 px de tolérance : un doigt n'est jamais parfaitement immobile, et sans
    // cette marge une pression normale passerait pour un micro-glissement.
    if (Math.abs(ecart) > 6) aBouge.current = true;
    dx.current = ecart;
    peindre(ecart);
  }

  function relacher() {
    if (!enCours.current) return;
    enCours.current = false;
    setGlisse(false);
    const ecart = dx.current;
    dx.current = 0;

    if (!aBouge.current) {
      peindre(0);
      onOuvrir?.();
      return;
    }
    if (Math.abs(ecart) >= SEUIL) {
      const dir: Direction = ecart > 0 ? "droite" : "gauche";
      setSortie(dir);
      // 450 ms : la durée de la course. Avancer avant, c'est escamoter le geste.
      window.setTimeout(() => onDecision?.(dir), 450);
      return;
    }
    // Le retour au centre est la SEULE animation du geste : on repose la
    // transition juste avant, sinon la carte reviendrait d'un coup sec.
    const el = racine.current;
    if (el) el.style.transition = "transform .24s cubic-bezier(.22,.61,.36,1)";
    peindre(0);
    if (tamponOui.current) tamponOui.current.style.opacity = "0";
    if (tamponNon.current) tamponNon.current.style.opacity = "0";
  }

  /**
   * La transition de la SORTIE accélère, elle ne décélère pas.
   *
   * Une décélération dépense l'essentiel de la distance dans les premières
   * millisecondes : sur un écran de 390 px, la carte quittait le cadre en
   * 70 ms. Le mouvement était mesurable et pourtant invisible. Et l'opacité
   * partait en même temps — la carte s'évaporait sur place au lieu de partir.
   */
  const transition = glisse
    ? "none"
    : sortieEffective
      ? "transform .45s cubic-bezier(.4,0,.85,.35), opacity .18s ease-in .27s"
      : "transform .24s cubic-bezier(.22,.61,.36,1), opacity .2s";

  return {
    racine,
    tamponOui,
    tamponNon,
    glisse,
    sortieEffective,
    transition,
    gestionnaires: {
      onPointerDown: commencer,
      onPointerMove: bouger,
      onPointerUp: relacher,
      onPointerCancel: relacher,
    },
  };
}
