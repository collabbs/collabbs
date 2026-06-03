"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/landing/Logo";
import { logout } from "@/app/auth/actions";

type NavItem = { href: string; label: string; icon: string };

const CREATOR_NAV: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: "🏠" },
  { href: "/opportunities", label: "Opportunités", icon: "🎯" },
  { href: "/deals", label: "Collaborations", icon: "🤝" },
  { href: "/messages", label: "Messages", icon: "💬" },
  { href: "/payouts", label: "Paiements", icon: "💶" },
  { href: "/notifications", label: "Notifications", icon: "🔔" },
  { href: "/profile", label: "Mon profil", icon: "👤" },
  { href: "/settings", label: "Réglages", icon: "⚙️" },
];

const BRAND_NAV: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: "🏠" },
  { href: "/campaigns", label: "Mes campagnes", icon: "📊" },
  { href: "/campaigns/new", label: "Créer une campagne", icon: "➕" },
  { href: "/creators", label: "Trouver des créateurs", icon: "🔍" },
  { href: "/shortlist", label: "Ma shortlist", icon: "⭐" },
  { href: "/deals", label: "Collaborations", icon: "🤝" },
  { href: "/messages", label: "Messages", icon: "💬" },
  { href: "/tracking", label: "Tracking", icon: "🔗" },
  { href: "/notifications", label: "Notifications", icon: "🔔" },
  { href: "/profile", label: "Mon profil", icon: "🏢" },
  { href: "/settings", label: "Réglages", icon: "⚙️" },
];

export default function Sidebar({
  role,
  name,
  avatarUrl,
  badges = {},
  attention = [],
}: {
  role: "creator" | "brand";
  name: string;
  avatarUrl: string | null;
  badges?: Record<string, number>;
  /** Hrefs avec un point ambré « à attention » (ex. tracking pas vérifié). */
  attention?: string[];
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const items = role === "creator" ? CREATOR_NAV : BRAND_NAV;
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const initials = name.slice(0, 2).toUpperCase();
  const notifCount = badges["/notifications"] ?? 0;

  // Fermer le drawer quand on change de page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Bloquer le scroll du body quand le drawer est ouvert.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  // Fermer avec Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const renderNavLink = (it: NavItem) => {
    const active = isActive(it.href);
    const badge = badges[it.href] ?? 0;
    const needsAttention = attention.includes(it.href);
    return (
      <Link
        key={it.href}
        href={it.href}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
          active
            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm"
            : "text-zinc-600 hover:bg-zinc-100"
        }`}
      >
        <span className="text-base">{it.icon}</span>
        <span className="whitespace-nowrap">{it.label}</span>
        {needsAttention && badge === 0 && (
          <span
            aria-label="À configurer"
            className={`ml-auto h-2 w-2 rounded-full ${
              active ? "bg-amber-200" : "bg-amber-500"
            }`}
          />
        )}
        {badge > 0 && (
          <span
            className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
              active ? "bg-white/25 text-white" : "bg-brand text-white"
            }`}
          >
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>
    );
  };

  const userBlock = (
    <div className="flex items-center gap-3 px-2">
      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-200 to-pink-200 text-xs font-bold text-purple-700">
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
  );

  return (
    <>
      {/* ============ Sidebar desktop (lg+) ============ */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-zinc-100 bg-white px-4 py-5 lg:flex">
        <Link href="/start" className="px-2">
          <Logo />
        </Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1">{items.map(renderNavLink)}</nav>
        <div className="border-t border-zinc-100 pt-4">
          {userBlock}
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

      {/* ============ Top bar mobile (< lg) ============ */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/start" aria-label="Accueil Collabbs">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-600 transition hover:bg-zinc-100"
          >
            🔔
            {notifCount > 0 && (
              <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={drawerOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 transition hover:bg-zinc-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ============ Drawer mobile (overlay + panneau droit) ============ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <Logo />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer le menu"
                className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-zinc-500 transition hover:bg-zinc-100"
              >
                ×
              </button>
            </div>
            <div className="border-b border-zinc-100 px-4 py-4">{userBlock}</div>
            <nav className="flex-1 overflow-y-auto px-3 py-3">
              <div className="flex flex-col gap-1">{items.map(renderNavLink)}</div>
            </nav>
            <form action={logout} className="border-t border-zinc-100 px-3 py-3">
              <button
                type="submit"
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-ink"
              >
                Se déconnecter
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
