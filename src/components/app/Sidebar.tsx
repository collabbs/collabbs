"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/landing/Logo";
import { logout } from "@/app/auth/actions";

type NavItem = { href: string; label: string; icon: string };

const CREATOR_NAV: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: "🏠" },
  { href: "/opportunities", label: "Opportunités", icon: "🎯" },
  { href: "/messages", label: "Messages", icon: "💬" },
  { href: "/onboarding/creator", label: "Mon profil", icon: "👤" },
];

const BRAND_NAV: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: "🏠" },
  { href: "/campaigns", label: "Mes campagnes", icon: "📊" },
  { href: "/campaigns/new", label: "Créer une campagne", icon: "➕" },
  { href: "/creators", label: "Trouver des créateurs", icon: "🔍" },
  { href: "/messages", label: "Messages", icon: "💬" },
  { href: "/onboarding/brand", label: "Mon profil", icon: "🏢" },
];

export default function Sidebar({
  role,
  name,
  avatarUrl,
}: {
  role: "creator" | "brand";
  name: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const items = role === "creator" ? CREATOR_NAV : BRAND_NAV;
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const initials = name.slice(0, 2).toUpperCase();

  const navLinks = (
    <>
      {items.map((it) => {
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            <span className="text-base">{it.icon}</span>
            <span className="whitespace-nowrap">{it.label}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-zinc-100 bg-white px-4 py-5 lg:flex">
        <Link href="/dashboard" className="px-2">
          <Logo />
        </Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1">{navLinks}</nav>
        <div className="border-t border-zinc-100 pt-4">
          <div className="flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-200 to-pink-200 text-xs font-bold text-purple-700">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{name}</span>
              <span className="block text-xs capitalize text-zinc-400">
                {role === "creator" ? "Créateur" : "Marque"}
              </span>
            </span>
          </div>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-ink"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      {/* Barre top + nav horizontale (mobile) */}
      <div className="sticky top-0 z-40 border-b border-zinc-100 bg-white lg:hidden">
        <div className="flex items-center justify-between px-5 py-3">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <form action={logout}>
            <button type="submit" className="text-sm font-medium text-zinc-500">
              Déconnexion
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none]">
          {navLinks}
        </nav>
      </div>
    </>
  );
}
