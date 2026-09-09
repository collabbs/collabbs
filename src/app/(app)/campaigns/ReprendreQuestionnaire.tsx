"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
/* ⚠️ CLE_BRIEF, et surtout pas CLE_CARTE.
   Le questionnaire MARQUE écrit sous `collabbs.brief.v1`, celui du créateur
   sous `collabbs.carte.v1`. Je lisais la seconde des deux côtés : une marque
   remplissait cinq étapes, s'inscrivait, arrivait sur ses campagnes — et il
   n'y avait rien, sans le moindre message. Le pont existait et ne raccordait
   rien. Trouvé par l'audit, jamais par moi : je n'avais pas pu jouer ce
   parcours faute de compte marque, et je l'avais annoncé sans le vérifier. */
import { CLE_BRIEF } from "@/lib/quiz";
import { creerCampagneDepuisCarte } from "./depuis-questionnaire";

/**
 * Reprend le questionnaire là où il s'était arrêté, une fois le compte créé.
 *
 * ─── Pourquoi ici ───
 * La marque répond au questionnaire AVANT d'avoir un compte : sa carte vit
 * dans le navigateur, elle ne peut pas être écrite en base à ce moment-là.
 * Le raccord doit donc se faire au premier passage dans l'espace marque.
 *
 * On le pose sur la liste des campagnes plutôt qu'à la fin de l'inscription :
 * c'est la page où l'on atterrit quoi qu'il arrive, et si quelque chose
 * échoue, la marque voit tout de suite le résultat — sa campagne dans la
 * liste, ou rien. Accroché à une redirection, un échec passerait inaperçu.
 *
 * ─── Ce qu'il ne fait pas ───
 * Il ne réessaie pas en boucle et ne signale pas d'erreur bruyante. La carte
 * reste dans le navigateur en cas d'échec : la marque peut créer sa campagne
 * à la main, et rien n'est perdu. Un bandeau d'erreur sur une page d'accueil
 * pour une action qu'elle n'a pas demandée serait plus inquiétant qu'utile.
 */
export default function ReprendreQuestionnaire() {
  const router = useRouter();
  // Sans ce verrou, le double montage du mode strict lance deux créations —
  // et la marque se retrouve avec sa campagne en double.
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current) return;
    lance.current = true;

    const brut = window.localStorage.getItem(CLE_BRIEF);
    if (!brut) return;

    let carte: unknown;
    try {
      carte = JSON.parse(brut);
    } catch {
      window.localStorage.removeItem(CLE_BRIEF);
      return;
    }
    // Seule une carte de marque nous concerne : un créateur qui aurait fait
    // le questionnaire de l'autre côté ne doit rien déclencher ici.
    if (!carte || typeof carte !== "object" || (carte as { cote?: string }).cote !== "brand") {
      return;
    }

    creerCampagneDepuisCarte(carte).then((r) => {
      if (!r.ok) return;
      window.localStorage.removeItem(CLE_BRIEF);
      router.refresh();
    });
  }, [router]);

  // Rien à afficher : la campagne apparaît dans la liste quand elle est prête.
  //
  // Un bandeau « on crée ta campagne… » aurait demandé un état posé depuis
  // l'effet, donc un rendu en cascade — et, s'il était lu dès le premier
  // rendu, une divergence entre le serveur et le navigateur. Pour une attente
  // d'une seconde sur une page déjà affichée, ça ne valait pas le coût.
  return null;
}
