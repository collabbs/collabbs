import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/landing/Logo";
import QuizCreateur from "./QuizCreateur";
import { SITE } from "@/lib/legal-entity";

/**
 * Le parcours d'entrée — en construction, à sa propre adresse.
 *
 * ⚠️ `/` n'est PAS touchée. Tant que ce parcours n'est pas validé, la page
 * d'accueil reste exactement ce qu'elle est. On bascule en un seul geste, à la
 * fin, quand il n'y aura plus de doute — pas en cassant l'existant en chemin.
 *
 * Pour l'instant seul le côté créateur est construit. Le côté marque produira
 * un BRIEF et non une fiche d'entreprise : un créateur ne fait pas défiler des
 * logos, il fait défiler des propositions.
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
    <div className="min-h-dvh bg-white">
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
      <QuizCreateur />
    </div>
  );
}
