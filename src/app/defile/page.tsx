import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/landing/Logo";
import Trace from "@/components/Trace";
import { createClient } from "@/lib/supabase/server";
import { briefsDuDefile } from "@/lib/defile";
import { getMarketplaceCreators } from "@/lib/creators-data";
import Defile from "./Defile";
import DefileCreateurs from "./DefileCreateurs";
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
  searchParams: Promise<{ apercu?: string; cote?: string }>;
}) {

  // `?apercu=match` force l'écran de match pour pouvoir le juger. Il s'annonce
  // comme un aperçu à l'écran : on ne laisse jamais croire à une vraie
  // réciprocité, ce serait promettre une réponse qui ne viendrait pas.
  const { apercu, cote } = await searchParams;
  // Les deux côtés ne font pas défiler la même chose : la marque regarde des
  // créateurs, le créateur regarde des briefs. Si chacun défilait sur l'autre,
  // le créateur ouvrirait le défilé et verrait UNE marque.
  const cotéMarque = cote === "marque";
  // Connecté, on sait ce que la personne a déjà vu et si une marque l'a
  // retenue : le paquet s'ajuste et le match devient possible. Anonyme, il n'y
  // a rien à croiser — et c'est normal, le défilé s'ouvre sans compte.
  const {
    data: { user: utilisateur },
  } = await (await createClient()).auth.getUser();

  const briefs = cotéMarque ? [] : await briefsDuDefile(utilisateur?.id);
  const createurs = cotéMarque ? await getMarketplaceCreators() : [];

  return (
    /* ⚠️ `h-dvh` et non `min-h-dvh`, avec une colonne.
       Le paquet mesurait DÉJÀ un écran entier, et le bandeau s'ajoutait
       par-dessus : la page débordait donc toujours d'une soixantaine de
       pixels, et l'on pouvait faire défiler derrière les cartes. Sur
       téléphone c'est pire — le geste vertical entre en conflit avec le
       glissement. La page tient un écran, le paquet prend ce qui reste. */
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      {/* En-tête minuscule : la carte doit prendre l'écran, c'est elle
          l'interaction. Mais on garde une sortie visible — quelqu'un qui ne
          comprend pas ce qu'il regarde doit pouvoir aller lire. */}
      {/* ⚠️ Le bandeau était contraint à 448 px sur une page qui peut en faire
          deux mille : le logo et le bouton se chevauchaient sur ordinateur.
          Il occupe maintenant la largeur, avec son contenu centré. */}
      <header className="w-full border-b border-zinc-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        {/* ⚠️ LE DÉFILÉ IGNORAIT QU'ON PUISSE ÊTRE CONNECTÉ.
            Le logo menait à la page publique et le bouton à l'inscription —
            pour tout le monde, y compris une marque qui avait déjà un compte.
            Arrivée au bout du paquet, elle atterrissait sur un formulaire
            d'inscription sans rien de son espace autour : elle se croyait
            déconnectée, et n'avait aucun chemin de retour vers son tableau de
            bord. Rapporté par Julien, le 10 septembre.

            Connecté, tout ramène donc à l'espace ; sinon, tout mène à
            l'inscription, comme avant. */}
        <Link
          href={utilisateur ? "/dashboard" : "/decouvrir"}
          aria-label="Collabbs"
          className="shrink-0"
        >
          <Logo size={26} />
        </Link>
        {/* ─── UN VRAI APPEL, PAS UNE INVITATION À LIRE ───

            Il y avait « C'est quoi Collabbs ? ». C'est une question, pas un
            appel : elle propose de PARTIR LIRE à quelqu'un qui est en train de
            faire défiler des campagnes. Le seul geste qui compte ici, c'est
            créer son profil — sans lui, aucun match ne mène nulle part. */}
        <Link
          href={
            utilisateur
              ? "/dashboard"
              : cotéMarque
                ? "/signup?role=brand"
                : "/signup?role=creator"
          }
          className="shrink-0 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
        >
          {utilisateur
            ? "Mon espace"
            : cotéMarque
              ? "Publier ma campagne"
              : "Créer mon profil"}
        </Link>
        </div>
      </header>
      <Trace etape="defile_ouvert" cote={cotéMarque ? "marque" : "createur"} />
      <div className="min-h-0 flex-1">
      {cotéMarque ? (
        <DefileCreateurs createurs={createurs} apercuMatch={apercu === "match"} connecte={Boolean(utilisateur)} />
      ) : (
        <Defile briefs={briefs} apercuMatch={apercu === "match"} connecte={Boolean(utilisateur)} />
      )}
      </div>
    </div>
  );
}
