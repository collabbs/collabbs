"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ALL_PERIODS, PERIOD_LABELS, type PeriodId } from "./period";

const SHORT: Record<PeriodId, string> = {
  "7d": "7 j",
  "30d": "30 j",
  "90d": "90 j",
  ytd: "YTD",
};

export default function PeriodPicker({ active }: { active: PeriodId }) {
  const sp = useSearchParams();
  function hrefFor(p: PeriodId): string {
    const next = new URLSearchParams(sp);
    next.set("period", p);
    return `?${next.toString()}`;
  }
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-zinc-100 bg-white p-1 shadow-sm">
      {ALL_PERIODS.map((p) => {
        const isActive = p === active;
        return (
          <Link
            key={p}
            href={hrefFor(p)}
            scroll={false}
            title={PERIOD_LABELS[p]}
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide transition ${
              isActive
                ? "bg-ink text-white shadow-sm"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-ink"
            }`}
          >
            {SHORT[p]}
          </Link>
        );
      })}
    </div>
  );
}
