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

export default async function PageDefile({
  searchParams,
}: {
  searchParams: Promise<{ apercu?: string }>;
}) {
  const briefs = await briefsDuDefile();
  // `?apercu=match` force l'écran de match pour pouvoir le juger. Il s'annonce
  // comme un aperçu à l'écran : on ne laisse jamais croire à une vraie
  // réciprocité, ce serait promettre une réponse qui ne viendrait pas.
  const { apercu } = await searchParams;

  return (
    <div className="min-h-dvh bg-white">
      {/* En-tête minuscule : la carte doit prendre l'écran, c'est elle
          l'interaction. Mais on garde une sortie visible — quelqu'un qui ne
          comprend pas ce qu'il regarde doit pouvoir aller lire. */}
      <header className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
        <Link href="/decouvrir" aria-label="Collabbs">
          <Logo size={26} />
        </Link>
        <Link
          href="/decouvrir"
          className="text-xs font-medium text-zinc-400 transition hover:text-ink"
        >
          C&apos;est quoi Collabbs&nbsp;?
        </Link>
      </header>
      <Defile briefs={briefs} apercuMatch={apercu === "match"} />
    </div>
  );
}
