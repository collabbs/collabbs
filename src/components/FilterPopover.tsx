"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Bouton-popover de filtre (desktop) — pattern marketplace pro
 * (Booking, Airbnb, eBay search filters).
 *
 * Compact : 1 ligne au lieu d'une grande carte. L'utilisateur clique
 * "Offre ▾" et n'ouvre que les options de ce groupe. Multi-popovers
 * peuvent s'ouvrir en série.
 *
 * - Click extérieur → ferme.
 * - Échap → ferme.
 * - Cliquer une chip à l'intérieur → ne ferme PAS (l'URL change, la
 *   chip se met en optimistic, le popover reste ouvert pour faire
 *   d'autres ajustements).
 */
export default function FilterPopover({
  label,
  activeLabel,
  children,
}: {
  label: string;
  /** Si fourni, le bouton montre "Label: ValeurActive" et a un état actif. */
  activeLabel?: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = Boolean(activeLabel);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
          isActive
            ? "border-ink bg-ink text-white shadow-sm"
            : "border-zinc-200 bg-white text-ink hover:border-zinc-300 hover:bg-zinc-50"
        }`}
      >
        <span>
          {label}
          {isActive && activeLabel && (
            <span className={isActive ? "ml-1.5 opacity-90" : "ml-1.5 text-zinc-500"}>
              · {activeLabel}
            </span>
          )}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-80 max-w-[90vw] rounded-2xl border border-zinc-100 bg-white p-4 shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}
