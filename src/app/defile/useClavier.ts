"use client";

import { useEffect } from "react";

/**
 * Les flèches du clavier, pour trancher sans la souris.
 *
 * ─── Pourquoi ───
 * Le défilé a été pensé au doigt, et sur ordinateur il ne restait que deux
 * boutons à viser à la souris — lent, et sans rapport avec le geste qu'on veut
 * installer. Une interface de tri se manie au clavier depuis toujours : la
 * boîte mail, le gestionnaire de photos, tout ce qui demande de décider vite.
 *
 * Gauche pour passer, droite pour garder : les mêmes directions que le
 * glissement, donc rien de nouveau à apprendre.
 *
 * ─── Ce qu'il ne fait pas ───
 * Il ne s'active pas quand on écrit dans un champ, ni quand un écran est
 * ouvert par-dessus : on ne veut pas trancher une carte qu'on ne regarde plus.
 */
export function useClavier({
  actif,
  onGauche,
  onDroite,
}: {
  actif: boolean;
  onGauche: () => void;
  onDroite: () => void;
}) {
  useEffect(() => {
    if (!actif) return;

    function surTouche(e: KeyboardEvent) {
      const cible = e.target as HTMLElement | null;
      // Écrire dans un champ ne doit jamais faire défiler une carte.
      if (cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName)) return;
      if (cible?.isContentEditable) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onGauche();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onDroite();
      }
    }

    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [actif, onGauche, onDroite]);
}
