import Link from "next/link";
import Logo from "@/components/landing/Logo";

export const metadata = { title: "Page introuvable — Collabbs" };

/**
 * Page 404. Sans ce fichier, Next affichait sa page par défaut : fond blanc,
 * « 404 — This page could not be found. » En anglais, sur un produit
 * entièrement français, sans un lien pour repartir. C'est l'écran que voit
 * quelqu'un qui a suivi un lien périmé — souvent son premier contact.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo size={40} />
      <p className="mt-10 font-mono text-sm text-zinc-400">404</p>
      <h1 className="mt-2 font-display text-2xl font-black text-ink">
        Cette page n&apos;existe pas
      </h1>
      <p className="mt-3 text-sm text-zinc-500">
        Le lien est peut-être périmé, ou la page a changé d&apos;adresse.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/creators"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Parcourir les créateurs
        </Link>
        <Link
          href="/"
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:text-ink"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
