import Link from "next/link";
import Logo from "./Logo";

const COLUMNS = [
  {
    title: "Produit",
    links: [
      { label: "Pour les créateurs", href: "/signup" },
      { label: "Pour les marques", href: "/signup?role=brand" },
      { label: "Tarifs", href: "#tarifs" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos", href: "#" },
      { label: "Contact", href: "mailto:contact@collabbs.com" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Conditions d'utilisation", href: "#" },
      { label: "Confidentialité", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-zinc-100 bg-zinc-50">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-6 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-12">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            La marketplace 100% française qui connecte créateurs et marques.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-ink">{col.title}</h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-500 transition hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-100 py-6">
        {/* Les mentions légales doivent être accessibles depuis toute page
            (article 6 de la LCEN) — d'où leur place dans le pied de page. */}
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-zinc-500">
          {[
            { href: "/legal/mentions", label: "Mentions légales" },
            { href: "/legal/cgu", label: "Conditions d'utilisation" },
            { href: "/legal/cgv", label: "Conditions de vente" },
            { href: "/legal/confidentialite", label: "Confidentialité" },
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="transition hover:text-ink">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs text-zinc-400">
          © 2026 Collabbs · Fait en France
        </p>
      </div>
    </footer>
  );
}
