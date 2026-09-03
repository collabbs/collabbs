import Link from "next/link";
import Logo from "./Logo";

// Chaque libellé nomme ce qui se passe quand on clique, et reprend le
// vocabulaire déjà employé plus bas (« Comment ça marche », CTA final).
//
// Avant : « Créateurs » menait à un formulaire d'inscription. Une marque qui
// clique sur « Créateurs » veut VOIR des créateurs — elle tombait sur un mur
// lui demandant un compte avant d'avoir rien vu. Le catalogue n'était par
// ailleurs accessible depuis aucune barre permanente, alors que c'est lui qui
// vend. Et « Créateurs » perdait le rôle que le visiteur venait de déclarer,
// là où « Marques » le transmettait : il fallait le rechoisir à l'écran suivant.
const LINKS = [
  { label: "Trouver un créateur", href: "/creators" },
  { label: "Devenir créateur", href: "/signup?role=creator" },
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
