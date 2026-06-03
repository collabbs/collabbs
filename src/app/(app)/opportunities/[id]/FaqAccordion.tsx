"use client";

import { useState } from "react";

export default function FaqAccordion({
  items,
}: {
  items: { q: string; a: string }[];
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <ul className="mt-4 space-y-2">
      {items.map((it, i) => {
        const open = openIdx === i;
        return (
          <li key={i} className="rounded-xl border border-zinc-100 bg-white">
            <button
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="text-sm font-bold text-ink">{it.q}</span>
              <span
                aria-hidden="true"
                className={`shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            </button>
            {open && (
              <div className="border-t border-zinc-100 px-4 py-3">
                <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600">
                  {it.a}
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
