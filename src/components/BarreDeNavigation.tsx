"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Le fil de chargement, en haut de l'écran, pendant un changement de page.
 *
 * ─── Le manque qu'il comble ───
 * Une page de l'application se rend sur le serveur. Entre le clic et
 * l'affichage il peut s'écouler deux secondes pendant lesquelles RIEN ne
 * bouge : le lien ne s'allume pas, la page reste celle d'avant. L'utilisateur
 * n'a aucun moyen de distinguer « ça charge » de « je n'ai pas cliqué assez
 * fort », et il reclique.
 *
 * ─── Pourquoi écouter les clics plutôt que la navigation ───
 * Le routeur ne publie plus d'évènements de navigation. On attrape donc le
 * clic en phase de capture — avant que quiconque l'annule — et on éteint le
 * fil quand l'URL a effectivement changé. C'est le seul point du code qui
 * connaisse cette astuce, et il couvre tous les liens du produit d'un coup :
 * ni les écrans ni les composants n'ont à s'en occuper.
 *
 * Trois cas ne sont PAS un chargement, et allumer le fil dessus serait mentir :
 * un lien qui ouvre un autre onglet, un lien qui sort du site, et un lien qui
 * pointe là où on est déjà.
 */

/** Filet : si rien ne se passe, le fil s'efface au lieu de tourner sans fin. */
const ABANDON_MS = 10_000;

export default function BarreDeNavigation() {
  // On retient l'adresse VISÉE, pas un booléen « ça charge ». L'affichage se
  // déduit alors d'une comparaison — visée ≠ actuelle — et s'éteint de lui-même
  // quand la page arrive, sans effet qui remette un état à jour après coup.
  const [cible, setCible] = useState<string | null>(null);
  const chemin = usePathname();
  const parametres = useSearchParams();

  const actuelle = parametres?.toString()
    ? `${chemin}?${parametres.toString()}`
    : chemin;
  const enCours = cible !== null && cible !== actuelle;

  useEffect(() => {
    function auClic(e: MouseEvent) {
      // Clic droit, clic milieu, ou avec une touche : le navigateur ouvre
      // ailleurs, la page courante ne bouge pas.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const lien = (e.target as HTMLElement | null)?.closest?.("a");
      if (!lien) return;

      const href = lien.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (lien.target === "_blank" || lien.hasAttribute("download")) return;

      const cible = new URL(href, window.location.href);
      if (cible.origin !== window.location.origin) return;
      // Déjà là : le routeur ne fera rien, le fil tournerait pour rien.
      if (cible.pathname + cible.search === window.location.pathname + window.location.search)
        return;

      setCible(cible.pathname + cible.search);
    }

    document.addEventListener("click", auClic, true);
    return () => document.removeEventListener("click", auClic, true);
  }, []);

  // Filet : une navigation qui n'aboutit pas — refusée, interrompue, remplacée
  // — laisserait le fil tourner indéfiniment. Il s'efface au bout de dix
  // secondes plutôt que de mentir.
  useEffect(() => {
    if (!enCours) return;
    const t = setTimeout(() => setCible(null), ABANDON_MS);
    return () => clearTimeout(t);
  }, [enCours]);

  if (!enCours) return null;

  return (
    <div
      role="status"
      aria-label="Chargement de la page"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-purple-100"
    >
      {/* La barre n'annonce pas une progression qu'on ne connaît pas : elle
          avance vite puis ralentit, ce qui dit « ça travaille » sans promettre
          une fin à telle seconde. */}
      <div className="h-full w-full origin-left animate-[barre_2.2s_ease-out_forwards] bg-gradient-to-r from-purple-600 to-pink-600" />
    </div>
  );
}
