import Link from "next/link";
import Logo from "./Logo";

const COLUMNS = [
  {
    title: "Produit",
    links: [
      { label: "Pour les créateurs", href: "/signup" },
      { label: "Pour les marques", href: "/signup?role=brand" },
      { label: "Tarifs", href: "#tarifs" },
      // Le blog vit dans « Produit » et pas dans un menu du haut : le haut de
      // page sert à faire s'inscrire. La plupart des lecteurs arriveront de
      // toute façon sur un article directement depuis une recherche.
      { label: "Outils gratuits", href: "/outils" },
      { label: "Ressources", href: "/blog" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      // « À propos » pointait sur `#` : un lien qui ne mène nulle part. On le
      // remettra le jour où la page existera — annoncer une rubrique absente
      // apprend au visiteur que les liens de ce site ne sont pas fiables, et
      // il cessera de cliquer sur les autres.
      { label: "Contact", href: "mailto:contact@collabbs.com" },
    ],
  },
  // La colonne « Légal » dupliquait « Conditions d'utilisation » et
  // « Confidentialité » vers `#`, alors que la barre du bas porte les VRAIS
  // liens. Le pied de page affichait donc chacun deux fois : une version qui
  // marche et une version morte, sans rien pour les distinguer. Sur des pages
  // légales, c'est exactement ce que la LCEN interdit — elles doivent être
  // accessibles « de manière directe et permanente ».
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
