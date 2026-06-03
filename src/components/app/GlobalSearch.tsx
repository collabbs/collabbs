"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchEverything, searchCreatorsByName, type SearchHit } from "@/app/(app)/search/actions";

/**
 * Recherche globale — pattern Linear / Notion / Vercel.
 * - Bouton dans la sidebar (desktop) ou top bar (mobile)
 * - Raccourci ⌘K / Ctrl+K depuis n'importe où dans l'app
 * - Modal full-screen sur mobile, centrée desktop
 * - Input avec debounce 250ms
 * - Résultats groupés Créateurs / Marques / Campagnes
 * - Navigation flèches + Enter
 */

const TYPE_META: Record<
  SearchHit["type"],
  { label: string; emoji: string }
> = {
  creator: { label: "Créateurs", emoji: "🎨" },
  brand: { label: "Marques", emoji: "🏢" },
  campaign: { label: "Campagnes", emoji: "🎯" },
};

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [, startTransition] = useTransition();
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Raccourci ⌘K / Ctrl+K global.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isModK) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus input à l'ouverture, body lock.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset à la fermeture.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  // Debounce search.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const [base, nameMatch] = await Promise.all([
          searchEverything(trimmed),
          searchCreatorsByName(trimmed),
        ]);
        // Merge sans doublons (par href).
        const seen = new Set<string>();
        const merged: SearchHit[] = [];
        for (const h of [...base, ...nameMatch]) {
          if (seen.has(h.href)) continue;
          seen.add(h.href);
          merged.push(h);
        }
        setHits(merged);
        setSearching(false);
        setActive(0);
      });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  function go(hit: SearchHit) {
    setOpen(false);
    router.push(hit.href);
  }

  function onKeyDownInput(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      go(hits[active]);
    }
  }

  // Groupement par type pour le rendu.
  const grouped: Record<SearchHit["type"], SearchHit[]> = {
    creator: [],
    brand: [],
    campaign: [],
  };
  hits.forEach((h) => grouped[h.type].push(h));
  let runningIdx = 0;

  return (
    <>
      {/* Bouton trigger — réutilisable, à insérer où on veut */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Recherche globale"
        className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-400 transition hover:border-zinc-300 hover:text-zinc-600"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <span className="flex-1 truncate text-left">Rechercher…</span>
        <span className="hidden rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-500 sm:inline">
          ⌘K
        </span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Recherche globale"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 top-0 mx-auto flex max-h-screen w-full max-w-xl flex-col bg-white shadow-2xl sm:top-[10vh] sm:max-h-[80vh] sm:rounded-2xl">
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 shrink-0 text-zinc-400"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.5" y2="16.5" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDownInput}
                placeholder="Cherche un créateur, une marque, une campagne…"
                className="flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-500 transition hover:bg-zinc-200"
              >
                Esc
              </button>
            </div>

            {/* Résultats */}
            <div className="flex-1 overflow-y-auto">
              {query.trim().length < 2 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-3xl">🔎</p>
                  <p className="mt-3 text-sm font-medium text-ink">
                    Tape au moins 2 caractères
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Trouve un créateur par nom ou @handle, une marque, ou une
                    campagne ouverte.
                  </p>
                </div>
              ) : searching ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-3xl">⏳</p>
                  <p className="mt-3 text-sm text-zinc-500">Recherche en cours…</p>
                </div>
              ) : hits.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-3xl">🤷</p>
                  <p className="mt-3 text-sm font-medium text-ink">Aucun résultat</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Essaie avec d&apos;autres mots-clés.
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  {(Object.keys(grouped) as SearchHit["type"][]).map((type) => {
                    const items = grouped[type];
                    if (items.length === 0) return null;
                    const meta = TYPE_META[type];
                    return (
                      <div key={type} className="px-2 py-1">
                        <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          {meta.emoji} {meta.label}
                        </p>
                        {items.map((h) => {
                          const idx = runningIdx++;
                          const isActive = idx === active;
                          return (
                            <button
                              key={h.href}
                              type="button"
                              onClick={() => go(h)}
                              onMouseEnter={() => setActive(idx)}
                              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                                isActive ? "bg-zinc-100" : "hover:bg-zinc-50"
                              }`}
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 text-sm font-bold text-purple-700">
                                {h.avatar ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={h.avatar}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  meta.emoji
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-ink">
                                  {h.title}
                                </p>
                                {h.subtitle && (
                                  <p className="truncate text-xs text-zinc-500">
                                    {h.subtitle}
                                  </p>
                                )}
                              </div>
                              {isActive && (
                                <span className="text-zinc-400">↵</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer hints */}
            {hits.length > 0 && (
              <div className="hidden items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-4 py-2 text-[11px] text-zinc-500 sm:flex">
                <span className="flex items-center gap-2">
                  <kbd className="rounded bg-white px-1.5 py-0.5 font-mono shadow-sm ring-1 ring-zinc-200">↑↓</kbd>
                  naviguer
                </span>
                <span className="flex items-center gap-2">
                  <kbd className="rounded bg-white px-1.5 py-0.5 font-mono shadow-sm ring-1 ring-zinc-200">↵</kbd>
                  ouvrir
                </span>
                <span className="flex items-center gap-2">
                  <kbd className="rounded bg-white px-1.5 py-0.5 font-mono shadow-sm ring-1 ring-zinc-200">esc</kbd>
                  fermer
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
