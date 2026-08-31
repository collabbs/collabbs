"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { declarerVues, validerVues } from "../actions";
import { montantAuxVues, vuesPourAtteindreLePlafond, vues as fmtVues } from "@/lib/performance";
import { eur } from "@/lib/deal";

/**
 * Le panneau des vues, des deux côtés de la collaboration.
 *
 * Une seule idée guide l'écran : **personne ne doit avoir à faire la division
 * de tête.** « 8 € / 1000 vues, plafond 400 € » ne dit rien tant qu'on n'a pas
 * calculé qu'il faut 50 000 vues pour toucher le maximum. Le créateur voit ce
 * qu'il gagne pendant qu'il saisit ; la marque voit ce qu'elle doit et ce qui
 * lui revient, avant de cliquer.
 */
export default function PerformancePanel({
  dealId,
  role,
  rate,
  cap,
  views,
  proofUrl,
  declaredAt,
  validatedAt,
  enSequestre,
  reliquat,
}: {
  dealId: string;
  role: "brand" | "creator";
  rate: number;
  cap: number;
  views: number | null;
  proofUrl: string | null;
  declaredAt: string | null;
  validatedAt: string | null;
  enSequestre: boolean;
  /**
   * Ce qui repart RÉELLEMENT chez la marque : le plafond non consommé PLUS la
   * commission correspondante, puisqu'elle est recalculée sur le montant
   * réellement versé.
   *
   * Calculé côté serveur depuis la transaction, parce que le taux qui compte
   * est celui figé au paiement — pas le taux courant. Écrire ici
   * « plafond − dû » donnerait un chiffre faux : la marque lirait 101 € et
   * recevrait 111 €.
   */
  reliquat: number | null;
}) {
  const router = useRouter();
  const [saisie, setSaisie] = useState(views != null ? String(views) : "");
  const [lien, setLien] = useState(proofUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seuil = vuesPourAtteindreLePlafond(rate, cap);
  const saisieNombre = Number(saisie.replace(/\s/g, ""));
  const apercu = Number.isFinite(saisieNombre) ? montantAuxVues(saisieNombre, rate, cap) : 0;
  const duValide = montantAuxVues(Number(views ?? 0), rate, cap);

  async function declarer() {
    setBusy(true);
    setError(null);
    const res = await declarerVues(dealId, { views: saisieNombre, proofUrl: lien });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error ?? "Erreur.");
  }

  async function valider() {
    setBusy(true);
    setError(null);
    const res = await validerVues(dealId);
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error ?? "Erreur.");
  }

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-black text-ink">Rémunération aux vues</h2>
        <p className="text-sm text-zinc-500">
          <strong className="text-ink">{eur(rate)} / 1000 vues</strong> · plafond {eur(cap)}
        </p>
      </div>

      {/* Le seuil est l'information qui manque partout ailleurs : elle
          transforme un tarif abstrait en objectif atteignable. */}
      {seuil != null && (
        <p className="mt-1 text-xs text-zinc-500">
          {role === "creator" ? "Tu touches" : "Le créateur touche"} le maximum à partir de{" "}
          <strong className="text-ink">{fmtVues(seuil)} vues</strong>. Au-delà, le montant reste
          plafonné.
        </p>
      )}

      {validatedAt ? (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">
            ✅ Vues validées — {eur(duValide)}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            {fmtVues(Number(views ?? 0))} vues retenues.
            {reliquat != null && reliquat > 0 && (
              <> Le reliquat de {eur(reliquat)} a été remboursé à la marque, commission comprise.</>
            )}
          </p>
          {proofUrl && (
            <a
              href={proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-emerald-800 underline"
            >
              Voir la publication
            </a>
          )}
        </div>
      ) : role === "creator" ? (
        <div className="mt-4 space-y-3">
          {/* Sans séquestre, déclarer ne mène nulle part : la validation sera
              refusée. Mieux vaut le dire ici que de laisser le créateur saisir
              son chiffre et se heurter à un mur. */}
          {!enSequestre && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              La marque n&apos;a pas encore réglé le séquestre. Tu peux déclarer tes vues, mais la
              validation ne sera possible qu&apos;une fois les fonds déposés.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Vues de ta publication</span>
              <input
                type="text"
                inputMode="numeric"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                placeholder="12 400"
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Lien de la publication</span>
              <input
                type="url"
                value={lien}
                onChange={(e) => setLien(e.target.value)}
                placeholder="https://www.tiktok.com/@toi/video/…"
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {/* Le calcul en direct : le créateur voit son gain se former pendant
              qu'il tape, plutôt que de découvrir le montant après coup. */}
          {saisieNombre > 0 && (
            <p className="text-sm text-zinc-600">
              Soit <strong className="text-ink">{eur(apercu)}</strong>
              {apercu >= cap && <> — le plafond est atteint.</>}
            </p>
          )}

          <button
            type="button"
            onClick={declarer}
            disabled={busy}
            className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? "Envoi…"
              : declaredAt
                ? "Corriger ma déclaration"
                : "Déclarer mes vues"}
          </button>
          {declaredAt && (
            <p className="text-xs text-zinc-500">
              Déclaration envoyée. Tu peux la corriger tant que la marque n&apos;a pas validé — une
              vidéo continue de tourner.
            </p>
          )}
        </div>
      ) : declaredAt ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-zinc-50 p-4">
            <p className="text-sm text-zinc-600">
              Le créateur déclare{" "}
              <strong className="text-ink">{fmtVues(Number(views ?? 0))} vues</strong>, soit{" "}
              <strong className="text-ink">{eur(duValide)}</strong>.
            </p>
            {duValide < cap && (
              <p className="mt-1 text-xs text-zinc-500">
                {reliquat != null ? (
                  <>
                    {eur(reliquat)} te seront remboursés à la validation — les {eur(cap - duValide)}{" "}
                    non consommés sur ton plafond, plus la commission correspondante.
                  </>
                ) : (
                  <>
                    Les {eur(cap - duValide)} non consommés sur ton plafond te seront remboursés à la
                    validation, avec la commission correspondante.
                  </>
                )}
              </p>
            )}
            {proofUrl && (
              <a
                href={proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-purple-700 underline"
              >
                Vérifier la publication
              </a>
            )}
          </div>
          {/* On ne cache pas que le chiffre est déclaratif : c'est ce qui rend
              la vérification nécessaire, et c'est le seul rempart qu'on ait. */}
          <p className="text-xs text-zinc-500">
            Ce chiffre est déclaré par le créateur — ouvre la publication et compare avant de
            valider. La validation fixe le montant définitivement.
          </p>
          <button
            type="button"
            onClick={valider}
            disabled={busy}
            className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Validation…" : `Valider ${fmtVues(Number(views ?? 0))} vues — ${eur(duValide)}`}
          </button>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">
          Le créateur n&apos;a pas encore déclaré les vues de sa publication. Tu pourras vérifier et
          valider ici — rien n&apos;est versé avant.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
