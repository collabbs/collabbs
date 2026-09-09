"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CLE_CARTE, CLE_INTERETS, CLE_REPERAGES, CLE_VUES, listeDeTextes } from "@/lib/quiz";
import { reprendreFavoris, reprendreReperages } from "./favoris/actions";
import { creerProfilDepuisCarte } from "./profile/depuis-questionnaire";
import { enregistrerVues } from "@/app/defile/actions";

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

    // ─── LA CARTE D'ABORD, LES FAVORIS ENSUITE ───
    //
    // Un créateur remplissait son questionnaire — pseudo, plateforme,
    // audience, niches, tarifs par format — puis tout était jeté et on lui
    // redemandait la même chose. Deux fois le même travail, et le second est
    // celui qu'on abandonne.
    //
    // Plus grave : sans profil il n'est visible d'aucune marque, donc aucune
    // ne peut le repérer, donc aucun match ne peut se former. Ce pont ne
    // manquait pas de confort, il bloquait la boucle.
    //
    // Côté marque, la reprise vit dans la liste des campagnes : c'est là que
    // le résultat se voit. Côté créateur, c'est son profil, donc ici.
    if (role !== "brand") {
      const carte = window.localStorage.getItem(CLE_CARTE);
      if (carte) {
        try {
          const objet = JSON.parse(carte);
          if (objet?.cote === "creator") {
            creerProfilDepuisCarte(objet).then((r) => {
              if (r.ok) {
                window.localStorage.removeItem(CLE_CARTE);
                router.refresh();
              }
            });
          }
        } catch {
          window.localStorage.removeItem(CLE_CARTE);
        }
      }
    }

    // Ce qui a défilé avant le compte suit aussi : sans ça, le paquet
    // remontrerait dès la première visite de l'espace ce que la personne
    // venait d'écarter.
    const vuesBrut = window.localStorage.getItem(CLE_VUES);
    if (vuesBrut) {
      try {
        const vues = listeDeTextes(JSON.parse(vuesBrut));
        if (vues.length > 0) void enregistrerVues(vues);
      } catch {
        window.localStorage.removeItem(CLE_VUES);
      }
    }

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

      // ─── UN MATCH NE SE DÉCOUVRE PAS DANS UNE LISTE ───
      //
      // Les deux côtés font défiler avant d'avoir un compte : la réciprocité
      // ne peut donc se constater qu'ici, au moment où l'identité existe. Si
      // elle existe, on ne laisse pas la personne tomber dessus par hasard
      // trois écrans plus loin — on l'y amène.
      if (r.matchs > 0) {
        router.push(`/favoris?match=${r.matchs}`);
        return;
      }
      if (r.ajoutes > 0) router.refresh();
    });
  }, [role, router]);

  return null;
}
