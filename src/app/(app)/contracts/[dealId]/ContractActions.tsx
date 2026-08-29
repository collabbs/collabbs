"use client";

import Link from "next/link";

/**
 * Barre d'actions du contrat. Masquée à l'impression pour que la feuille
 * imprimée ne contienne que le contrat lui-même.
 */
export default function ContractActions({
  reference,
  dealId,
  canExport = true,
}: {
  reference: string;
  dealId: string;
  /** Faux pour les contrats d'ancien format : pas de PDF conforme possible. */
  canExport?: boolean;
}) {
  return (
    <div className="sticky top-4 z-20 mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-white px-4 py-3 shadow-md print:hidden">
      <div>
        <Link
          href={`/deals/${dealId}`}
          className="text-sm font-medium text-zinc-500 transition hover:text-ink"
        >
          ← Retour à la collaboration
        </Link>
        <p className="mt-0.5 font-mono text-xs text-zinc-400">{reference}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        >
          Imprimer
        </button>
        {canExport && (
          <a
            href={`/contracts/${dealId}/pdf`}
            className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            ⬇ Télécharger le PDF
          </a>
        )}
      </div>
    </div>
  );
}
