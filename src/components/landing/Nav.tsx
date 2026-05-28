import Link from "next/link";
import Logo from "./Logo";

const LINKS = [
  { label: "Créateurs", href: "/signup" },
  { label: "Marques", href: "/signup?role=brand" },
  { label: "Tarifs", href: "#tarifs" },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Accueil Collabbs">
          <Logo />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-zinc-600 transition hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-zinc-600 transition hover:text-ink sm:block"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            S&apos;inscrire
          </Link>
        </div>
      </nav>
    </header>
  );
}
