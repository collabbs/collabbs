"use client";

import Link from "next/link";

export default function PrintButton({ invoiceNumber }: { invoiceNumber: string }) {
  return (
    <div className="sticky top-4 z-20 mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-white px-4 py-3 shadow-md print:hidden">
      <div>
        <Link
          href="/payouts"
          className="text-sm font-medium text-zinc-500 transition hover:text-ink"
        >
          ← Retour
        </Link>
        <p className="mt-0.5 font-mono text-xs text-zinc-400">{invoiceNumber}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          📄 Imprimer / Enregistrer PDF
        </button>
      </div>
    </div>
  );
}
