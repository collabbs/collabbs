"use client";

import { useEffect, useRef } from "react";
import { origineDeSession } from "@/lib/origine";

/**
 * Le canal d'arrivée, transmis avec l'inscription.
 *
 * ─── Pourquoi un champ caché et pas une lecture serveur ───
 * L'origine est mémorisée au PREMIER contact, dans le navigateur (voir
 * `lib/origine.ts`). Quand quelqu'un arrive par TikTok, lit deux pages, puis
 * s'inscrit, l'URL de la page d'inscription ne porte plus aucun `utm_source`
 * — le serveur ne peut donc rien en savoir. Seul le navigateur se souvient.
 *
 * ─── Pourquoi une écriture dans le DOM et pas un état React ───
 * Le réflexe est `useState` + `useEffect`. React le déconseille et son linter
 * le refuse (`react-hooks/set-state-in-effect`) : ça provoque deux rendus, un
 * vide puis un rempli. Le projet a déjà la réponse générale dans
 * `hooks/useStockageLocal` — `useSyncExternalStore`.
 *
 * Ici, plus simple suffit : ce champ n'est jamais LU par React, il est lu par
 * le navigateur au moment d'envoyer le formulaire. On écrit donc directement
 * sa valeur. Le serveur et le client rendent exactement le même HTML — un
 * champ caché vide — donc aucune discordance d'hydratation, et aucun état à
 * synchroniser.
 *
 * ─── Ce que ça ne fait pas ───
 * Il ne transporte qu'une étiquette de canal, bornée à la liste de
 * `lib/origine.ts`, et le serveur la revérifie de son côté : un formulaire
 * bricolé ne peut pas écrire autre chose. Rien d'identifiant ne passe ici.
 *
 * Sans JavaScript, le champ part vide, ce qui compte comme une arrivée
 * directe. Mieux vaut une mesure incomplète qu'une inscription bloquée.
 */
export default function ChampOrigine() {
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const canal = origineDeSession();
    if (canal && champ.current) champ.current.value = canal;
  }, []);

  return <input ref={champ} type="hidden" name="origine" defaultValue="" />;
}
