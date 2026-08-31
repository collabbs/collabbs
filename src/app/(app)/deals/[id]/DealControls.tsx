"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  acceptDeal,
  cancelDeal,
  completeDeal,
  updateDealTerms,
} from "../actions";
import DeliverableRow, { type Deliverable } from "./DeliverableRow";
import {
  supplementDroits,
  libelleDroits,
  PERIMETRES,
  PERIMETRE_LABEL,
  PERIMETRE_DESCRIPTION,
  type Perimetre,
} from "@/lib/droits";
import RevisionPanel from "./RevisionPanel";

type Props = {
  dealId: string;
  role: "brand" | "creator";
  status: "negotiation" | "active" | "completed" | "cancelled";
  deliverables: Deliverable[];
  terms: {
    amount: number;
    quantity: number;
    deadline: string | null;
    brandNotes: string | null;
    usageRightsMonths: number | null;
    usageRightsScope: "organic" | "paid" | null;
    usageRightsFee: number | null;
    exclusivity: boolean;
    exclusivityDays: number | null;
    shippingRequired: boolean;
  };
  /** Compteur retouches du deal (passé par la page parent). */
  revisions?: { used: number; max: number };
  /**
   * Tarif aux vues (€ / 1000), quand la collaboration en a un.
   *
   * Il ne change rien au calcul — le champ écrit toujours `amount` — mais il
   * change ce que le champ VEUT DIRE. Sur une campagne aux vues, ce montant
   * n'est pas ce que touchera le créateur : c'est le maximum qu'il pourra
   * toucher, et ce que la marque va séquestrer. Le libeller « Montant »
   * laisserait la marque croire qu'elle fixe un forfait.
   */
  perfRate?: number | null;
};

export default function DealControls({ dealId, role, status, deliverables, terms, revisions, perfRate }: Props) {
  const revRemaining = revisions ? Math.max(0, revisions.max - revisions.used) : 0;
  const revMax = revisions?.max ?? 0;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [quantity, setQuantity] = useState(terms.quantity);
  const [envoiRequis, setEnvoiRequis] = useState(terms.shippingRequired);
  const [deadline, setDeadline] = useState(terms.deadline ?? "");
  const [notes, setNotes] = useState(terms.brandNotes ?? "");
  // Ces deux termes étaient écrits dans le contrat sans que personne ne puisse
  // les fixer. Ils décident de ce que la marque a le droit de faire du contenu
  // après la livraison — c'est tout sauf un détail.
  const [droits, setDroits] = useState(terms.usageRightsMonths ?? "");
  const [perimetre, setPerimetre] = useState<Perimetre>(terms.usageRightsScope ?? "organic");
  // Le montant du contenu, hors droits. C'est LUI que la marque manipule ; le
  // total suit. Saisir un total dont une part invisible paie des droits
  // reviendrait à lui faire deviner ce qu'elle achète.
  const [contenu, setContenu] = useState(
    Math.max(0, terms.amount - (terms.usageRightsFee ?? 0)),
  );

  // Les droits ne sont facturés que s'il y a une durée. Le total est TOUJOURS
  // la somme des deux : la marque ne peut pas se retrouver avec un montant qui
  // ne correspond à rien de nommé.
  const moisDroits = droits === "" ? null : Number(droits);
  const fraisDroits = moisDroits ? supplementDroits(contenu, moisDroits, perimetre) : 0;
  const amount = contenu + fraisDroits;
  const [exclu, setExclu] = useState(terms.exclusivity);
  const [excluJours, setExcluJours] = useState(terms.exclusivityDays ?? "");

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error ?? "Erreur.");
  }

  const allApproved =
    deliverables.length > 0 && deliverables.every((d) => d.approved);

  return (
    <div className="space-y-5">
      {/* Livrables */}
      {(status === "active" || status === "completed") && deliverables.length > 0 && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-black text-ink">Livrables</h2>
            {revisions && (
              <p className="text-xs text-zinc-500">
                <strong className="text-ink">{revisions.used}/{revisions.max}</strong>{" "}
                round{revisions.max > 1 ? "s" : ""} de retouches utilisé
                {revisions.used > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <ul className="mt-3 space-y-2.5">
            {deliverables.map((d) => {
              // Côté marque : panneau retouches uniquement si livré + non validé + statut actif
              const showRevisionPanel =
                role === "brand" &&
                status === "active" &&
                d.done &&
                !d.approved;
              return (
                <DeliverableRow
                  key={d.id}
                  d={d}
                  dealId={dealId}
                  role={role}
                  status={status}
                  busy={busy}
                  onAction={run}
                  revisionPanel={
                    showRevisionPanel && revisions ? (
                      <RevisionPanel
                        deliverableId={d.id}
                        deliverableLabel={d.label}
                        remaining={revRemaining}
                        max={revMax}
                      />
                    ) : null
                  }
                />
              );
            })}
          </ul>
        </div>
      )}

      {/* Édition des termes (marque, négociation) */}
      {role === "brand" && status === "negotiation" && editing && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">Ajuster les termes</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-xs font-semibold text-zinc-500">
                {perfRate ? "Plafond (€)" : "Montant du contenu (€)"}
              </span>
              <input
                type="number"
                min={0}
                value={contenu}
                onChange={(e) => setContenu(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
              {perfRate ? (
                <span className="mt-1 block text-xs text-zinc-500">
                  Payé {perfRate} € / 1000 vues, dans la limite de ce plafond
                  {amount > 0 && (
                    <> — soit le maximum atteint à {Math.ceil((amount / perfRate) * 1000).toLocaleString("fr-FR")} vues</>
                  )}
                  . C&apos;est ce montant que tu séquestres ; le reliquat te revient.
                </span>
              ) : null}
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold text-zinc-500">Quantité de contenus</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-xs font-semibold text-zinc-500">Échéance</span>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold text-zinc-500">
                Droits d&apos;utilisation (mois)
              </span>
              <input
                type="number"
                min={1}
                max={120}
                value={droits}
                onChange={(e) =>
                  setDroits(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="12"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
              <span className="mt-1 block text-[11px] text-zinc-400">
                Durée pendant laquelle tu pourras réutiliser le contenu sur tes
                supports. Vide = aucune réutilisation au-delà de la publication.
              </span>
            </label>
            {/* Le périmètre n'apparaît qu'une fois la durée posée : demander
                « pour quel usage ? » avant « pendant combien de temps ? » n'a
                pas de sens, et une durée vide ne cède rien. */}
            {moisDroits ? (
              <label className="text-sm sm:col-span-2">
                <span className="text-xs font-semibold text-zinc-500">
                  Ce que tu pourras en faire
                </span>
                <span className="mt-1 grid gap-2 sm:grid-cols-2">
                  {PERIMETRES.map((p) => (
                    <span
                      key={p}
                      onClick={() => setPerimetre(p)}
                      className={`cursor-pointer rounded-lg border p-3 transition ${
                        perimetre === p
                          ? "border-purple-400 bg-purple-50"
                          : "border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {PERIMETRE_LABEL[p]}
                        </span>
                        <span className="text-sm font-bold text-brand-deep">
                          +{supplementDroits(contenu, moisDroits, p)}€
                        </span>
                      </span>
                      <span className="mt-1 block text-[11px] text-zinc-500">
                        {PERIMETRE_DESCRIPTION[p]}
                      </span>
                    </span>
                  ))}
                </span>
                {/* La décomposition, en clair. Le créateur touche les deux
                    lignes : c'est son droit qu'on licencie. */}
                <span className="mt-2 block rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
                  Contenu <strong className="text-ink">{contenu}€</strong> + droits{" "}
                  <strong className="text-ink">{fraisDroits}€</strong> ={" "}
                  <strong className="text-ink">{amount}€</strong> pour le créateur.{" "}
                  {libelleDroits(moisDroits, perimetre)}.
                </span>
              </label>
            ) : null}
            <label className="text-sm">
              <span className="text-xs font-semibold text-zinc-500">Exclusivité</span>
              <span className="mt-1 flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                <input
                  type="checkbox"
                  checked={exclu}
                  onChange={(e) => setExclu(e.target.checked)}
                />
                <span className="text-sm text-zinc-600">Pas de marque concurrente</span>
              </span>
              {exclu && (
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={excluJours}
                  onChange={(e) =>
                    setExcluJours(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="30 jours"
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                />
              )}
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-xs font-semibold text-zinc-500">Envoi d&apos;un produit</span>
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={envoiRequis}
                  onChange={(e) => setEnvoiRequis(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span className="text-sm text-zinc-600">
                  J&apos;envoie un produit au créateur avant qu&apos;il produise son contenu
                </span>
              </span>
              {/* Le créateur ne peut pas tourner ce qu'il n'a pas reçu. Cocher
                  ouvre l'échange d'adresse et le suivi du colis ; ne pas cocher
                  laisserait les deux parties s'attendre sans le savoir. */}
              {envoiRequis && (
                <span className="mt-1 block text-xs text-zinc-500">
                  Le créateur pourra indiquer son adresse, et tu pourras déclarer l&apos;envoi avec
                  son suivi.
                </span>
              )}
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-xs font-semibold text-zinc-500">Brief / notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const res = await updateDealTerms(dealId, {
                    amount,
                    quantity,
                    deadline: deadline || null,
                    brandNotes: notes,
                    usageRightsMonths: moisDroits,
                    usageRightsScope: moisDroits ? perimetre : null,
                    usageRightsFee: moisDroits ? fraisDroits : null,
                    exclusivity: exclu,
                    exclusivityDays: excluJours === "" ? null : Number(excluJours),
                    shippingRequired: envoiRequis,
                  });
                  if (res.ok) setEditing(false);
                  return res;
                })
              }
              className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full px-5 py-2 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Barre d'actions */}
      {status !== "completed" && status !== "cancelled" && (
        <div className="flex flex-wrap items-center gap-2">
          {role === "creator" && status === "negotiation" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => acceptDeal(dealId))}
                className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Accepter le deal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => cancelDeal(dealId))}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Refuser
              </button>
            </>
          )}

          {role === "brand" && status === "negotiation" && (
            <>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {editing ? "Fermer l'édition" : "Modifier les termes"}
              </button>
              <span className="text-xs text-zinc-400">En attente de l&apos;acceptation du créateur</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => cancelDeal(dealId))}
                className="ml-auto rounded-full px-4 py-2 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Annuler le deal
              </button>
            </>
          )}

          {role === "brand" && status === "active" && (
            <>
              <button
                type="button"
                disabled={busy || !allApproved}
                title={!allApproved ? "Valide tous les livrables d'abord" : undefined}
                onClick={() => run(() => completeDeal(dealId))}
                className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Clôturer le deal
              </button>
              {!allApproved && (
                <span className="text-xs text-zinc-400">Valide tous les livrables pour clôturer</span>
              )}
            </>
          )}

          {role === "creator" && status === "active" && (
            // Ne renvoyer « ci-dessus » que s'il y a effectivement quelque
            // chose au-dessus. Sans livrable, cette phrase désignait le vide.
            <span className="text-sm text-zinc-500">
              {deliverables.length > 0
                ? "Marque tes livrables comme livrés ci-dessus — la marque valide puis clôture."
                : "Aucun livrable n'est encore défini pour cette collaboration. Écris à la marque pour qu'elle précise ce qui est attendu."}
            </span>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
