"use client";

import { useStockageLocal } from "@/hooks/useStockageLocal";
import { CLE_COTE, type Cote } from "@/lib/quiz";
import ChoixCote from "./ChoixCote";
import QuizCreateur from "./QuizCreateur";
import QuizMarque from "./QuizMarque";

/**
 * L'aiguillage du parcours d'entrée.
 *
 * Le côté choisi est gardé dans le navigateur : quelqu'un qui revient ne
 * repasse pas par « tu es une marque ou un créateur ? » — il a déjà répondu, et
 * lui reposer la question donne l'impression d'avoir tout perdu.
 *
 * `null` = pas encore choisi. On ne devine pas : c'est la seule chose qu'on ne
 * peut pas déduire, et c'est pour ça qu'elle vient en premier.
 */
export default function Parcours() {
  const [cote, setCote] = useStockageLocal<Cote | null>(CLE_COTE, null);

  if (cote === "creator") return <QuizCreateur />;
  if (cote === "brand") return <QuizMarque />;
  return <ChoixCote onChoix={(c) => setCote(c)} />;
}
