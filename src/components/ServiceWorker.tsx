"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker. Sans lui, le navigateur ne propose pas
 * « Installer l'application » — c'est sa seule raison d'être ici, avec la page
 * hors ligne.
 *
 * L'échec est silencieux VOLONTAIREMENT : un service worker qui ne s'installe
 * pas (navigateur ancien, mode privé, http) ne doit rien changer au produit.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const t = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* rien à faire : l'application marche sans. */
      });
    }, 2000); // après le premier rendu : rien ne doit retarder l'affichage.
    return () => clearTimeout(t);
  }, []);

  return null;
}
