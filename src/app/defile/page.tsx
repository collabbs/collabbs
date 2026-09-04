import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/landing/Logo";
import { briefsDuDefile } from "@/lib/defile";
import Defile from "./Defile";
import { SITE } from "@/lib/legal-entity";

/**
 * Le défilé — public, sans compte.
 *
 * C'est la suite immédiate du questionnaire : quelqu'un qui vient de fabriquer
 * sa carte arrive ici, pas sur un formulaire d'inscription. Le compte se
 * demande plus tard, au moment où il veut qu'une marque sache qu'il existe.
 *
 * ⚠️ `/` reste intacte. Cette page vit à sa propre adresse tant que le
 * parcours n'est pas validé.
 */
export const metadata: Metadata = {
  title: "Les campagnes ouvertes — Collabbs",
  description:
    "Fais défiler les briefs des marques. Sans compte, sans engagement.",
  alternates: { canonical: `${SITE.url}/defile` },
  robots: { index: false, follow: false },
};

export default async function PageDefile() {
  const briefs = await briefsDuDefile();

  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-lg items-center justify-between px-5 py-5">
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
      <Defile briefs={briefs} />
    </div>
  );
}
