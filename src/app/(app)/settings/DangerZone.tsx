"use client";

import { useState } from "react";
import BoutonSoumettre from "@/components/BoutonSoumettre";
import { deleteAccount } from "./actions";

export default function DangerZone({ error }: { error: string | null }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  return (
    <div className="mt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-inset ring-red-200 transition hover:bg-red-50"
        >
          Supprimer mon compte
        </button>
      ) : (
        <div className="rounded-xl border border-red-200 bg-white p-4">
          <p className="text-sm font-bold text-red-700">
            Cette action est définitive.
          </p>
          {/* Ces trois lignes décrivaient un comportement que le produit n'a
              pas. `deleteAccount` n'annule AUCUNE collaboration et ne rembourse
              AUCUN séquestre : il REFUSE la suppression tant que quelque chose
              est en cours, et dit quoi faire pour partir proprement.

              Constaté le 22/10/2026 en tentant la suppression pour de vrai :
              l'écran promettait « les fonds en séquestre seront remboursés à la
              marque », et le refus répondait « Une somme de 108,00 € est encore
              immobilisée […] il faut d'abord que ces collaborations aillent à
              leur terme ». Une promesse fausse sur le seul bouton irréversible
              du produit.

              L'ordre compte aussi : on annonce d'abord ce qui bloque, ensuite
              seulement ce qui est définitif. Quelqu'un qui a de l'argent en
              cours doit comprendre qu'il ne peut pas encore partir, pas croire
              qu'il va tout perdre. */}
          <ul className="mt-2 space-y-1 text-xs text-red-600">
            <li>
              • Tant qu&apos;une collaboration ou un paiement est en cours, la
              suppression est refusée — on te dira quoi terminer d&apos;abord.
            </li>
            <li>
              • Tes commissions d&apos;affiliation non versées sont perdues :
              attends le prochain versement avant de partir.
            </li>
            <li>• Tes contrats signés sont archivés pour l&apos;autre partie.</li>
            <li>• Ton profil et toutes tes données seront supprimés.</li>
            <li>• Tu ne pourras pas récupérer ton compte.</li>
          </ul>

          <form action={deleteAccount} className="mt-4">
            <label
              htmlFor="confirm"
              className="block text-xs font-medium text-red-700"
            >
              Pour confirmer, tape{" "}
              <strong className="font-mono">SUPPRIMER</strong> ci-dessous :
            </label>
            <input
              id="confirm"
              name="confirm"
              type="text"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1.5 w-full max-w-md rounded-lg border border-red-200 px-3 py-2 text-sm font-mono outline-none focus:border-red-400"
              placeholder="SUPPRIMER"
            />

            {error && (
              <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <BoutonSoumettre
                disabled={confirmText !== "SUPPRIMER"}
                className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-40"
              >
                Supprimer définitivement mon compte
              </BoutonSoumettre>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                }}
                className="rounded-full px-5 py-2 text-sm font-medium text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
