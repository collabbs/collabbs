"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CLE_INTERETS, CLE_REPERAGES, listeDeTextes } from "@/lib/quiz";
import { reprendreFavoris, reprendreReperages } from "./favoris/actions";

/**
 * Ramène dans le compte ce qui a été retenu pendant le défilé.
 *
 * ─── Pourquoi c'est nécessaire ───
 * Le défilé s'utilise AVANT d'avoir un compte — c'est tout son intérêt comme
 * porte d'entrée. Rien ne peut donc être écrit au moment du geste : les
 * intérêts vivent dans le navigateur. Sans reprise, un créateur qui aimait
 * huit campagnes puis créait son compte ne retrouvait rien, et tout le tunnel
 * menait à un geste dont le résultat était jeté.
 *
 * ─── Pourquoi dans la disposition ───
 * On ne sait pas où quelqu'un atterrit après son inscription. Posée sur la
 * disposition de l'espace, la reprise a lieu quelle que soit la page.
 *
 * Elle ne fait rien de visible : la personne trouve simplement ses favoris là
 * où elle les attend. Un bandeau pour une action qu'elle n'a pas demandée
 * inquiéterait plus qu'il n'informerait.
 */
export default function RepriseDuDefile({ role }: { role: string | null }) {
  const router = useRouter();
  // Sans ce verrou, le double montage du mode strict rejoue la reprise.
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current) return;
    lance.current = true;

    const cle = role === "brand" ? CLE_REPERAGES : CLE_INTERETS;
    const brut = window.localStorage.getItem(cle);
    if (!brut) return;

    let ids: string[];
    try {
      ids = listeDeTextes(JSON.parse(brut));
    } catch {
      window.localStorage.removeItem(cle);
      return;
    }
    if (ids.length === 0) return;

    const reprendre = role === "brand" ? reprendreReperages : reprendreFavoris;
    reprendre(ids).then((r) => {
      if (!r.ok) return;
      // On ne vide qu'en cas de succès : un échec réseau ne doit pas coûter à
      // quelqu'un les campagnes qu'il vient de retenir.
      window.localStorage.removeItem(cle);
      if (r.ajoutes > 0) router.refresh();
    });
  }, [role, router]);

  return null;
}
