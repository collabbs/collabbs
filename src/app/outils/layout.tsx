import Link from "next/link";
import Footer from "@/components/landing/Footer";

/**
 * L'habillage des outils publics.
 *
 * Même raisonnement que pour les ressources : ce sont des pages où le visiteur
 * arrive **sans connaître Collabbs**, depuis une recherche ou un lien partagé
 * dans un groupe. Sans en-tête il se sert d'un calculateur sans savoir de qui
 * il vient ; sans pied de page il n'a aucun moyen de vérifier à qui il a
 * affaire — ce qui compte doublement quand l'outil chiffre de l'argent.
 */
export default function OutilsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="font-display text-xl font-black tracking-tight text-ink">
            colla<span className="text-purple-600">bb</span>s
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/creators"
              className="hidden text-sm font-medium text-zinc-600 transition hover:text-ink sm:block"
            >
              Parcourir les créateurs
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </header>

      {children}

      <Footer />
    </>
  );
}
