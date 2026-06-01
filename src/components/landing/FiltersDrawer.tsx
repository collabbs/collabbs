"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Bouton "Filtres (N)" + bottom-sheet — MOBILE UNIQUEMENT.
 * Sur desktop (lg+) le composant ne rend rien : la page se charge de
 * présenter ses filtres comme elle veut (carte, sidebar, etc.).
 *
 * Les chips à l'intérieur sont des <FilterChip> qui naviguent vers
 * /creators?... → on ferme automatiquement la sheet à chaque
 * changement de pathname.
 */
export default function FiltersDrawer({
  activeCount,
  children,
}: {
  activeCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fermer quand l'URL change (un chip a été cliqué).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bloquer le scroll du body quand ouverte.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape pour fermer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Mobile : bouton déclencheur */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-ink shadow-sm transition hover:bg-zinc-50"
        >
          <span className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-zinc-500"
              aria-hidden="true"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filtres
            {activeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-1.5 text-xs font-bold text-white">
                {activeCount}
              </span>
            )}
          </span>
          <span className="text-zinc-400">›</span>
        </button>
      </div>

      {/* Bottom-sheet mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h2 className="font-display text-lg font-black text-ink">Filtres</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-zinc-500 transition hover:bg-zinc-100"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
            <div className="border-t border-zinc-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Voir les résultats
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
