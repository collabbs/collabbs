import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/landing/Logo";
import Parcours from "./commencer/Parcours";
import Trace from "@/components/Trace";
import { SITE } from "@/lib/legal-entity";
import { FOND } from "./commencer/styles";

/**
 * La page d'accueil : le parcours d'entrée.
 *
 * ─── La bascule ───
 * Le questionnaire a vécu six mois sur `/commencer`, le temps d'être bon.
 * Pendant ce temps, RIEN dans le site n'y menait — vérifié : zéro lien. Le
 * tunnel n'existait que pour ceux à qui on envoyait l'adresse, et tout le
 * travail dessus ne servait personne.
 *
 * L'accueil pose donc la question qui trie — marque ou créateur — au lieu
 * d'expliquer. La landing n'est pas perdue : elle garde son adresse,
 * `/decouvrir`, et reste l'échappatoire de qui n'a pas encore d'idée.
 *
 * Les deux côtés sont construits. Celui de la marque produit un BRIEF et non
 * une fiche d'entreprise : un créateur ne fait pas défiler des logos, il fait
 * défiler des propositions.
 */
export const metadata: Metadata = {
  title: "Crée ta carte — Collabbs",
  description:
    "Cinq questions, et les marques peuvent te trouver. Sans compte, sans engagement.",
  alternates: { canonical: `${SITE.url}/commencer` },
  // Page de parcours, pas de contenu : rien à indexer, et surtout pas pendant
  // qu'elle se construit.
  robots: { index: false, follow: false },
};

export default function PageCommencer() {
  return (
    <div className={`min-h-dvh ${FOND}`}>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link href="/decouvrir" aria-label="Collabbs">
          <Logo />
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-zinc-500 transition hover:text-ink"
        >
          J&apos;ai déjà un compte
        </Link>
      </header>
      <Trace etape="tunnel_ouvert" />
      <Parcours />
    </div>
  );
}
