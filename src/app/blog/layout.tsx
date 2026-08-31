import Link from "next/link";
import Footer from "@/components/landing/Footer";

/**
 * L'habillage des pages de ressources.
 *
 * Ces pages sont les seules où le visiteur arrive **sans connaître Collabbs** :
 * il vient d'une recherche Google et atterrit au milieu du site. Sans en-tête,
 * il lit un texte sans savoir de qui il vient ; sans pied de page, il n'a aucun
 * moyen de vérifier à qui il a affaire.
 *
 * D'où les deux ajouts par rapport aux pages légales, qui se contentent d'un
 * lien retour : un en-tête qui dit le nom et propose l'inscription, et le pied
 * de page complet — mentions légales comprises, ce qui compte quand on vend de
 * la conformité.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
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
