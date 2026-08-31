import { TARIFS, PLANS, type Plan } from "@/lib/tarifs";
import { souscrireAbonnement } from "@/app/(app)/billing/actions";

/**
 * Les plans, et surtout ce qu'ils auraient fait gagner.
 *
 * Un tableau de prix ne vend rien tout seul. Ce qui vend, c'est le montant que
 * la marque a réellement dépensé ce mois-ci, et la commission qu'elle aurait
 * payée avec chaque plan. Elle n'a personne à croire : elle lit ses propres
 * chiffres. C'est ce que font Collabstr et Insense — l'abonnement n'ouvre pas
 * de portes, il achète un taux.
 */
export default function PlansAbonnement({
  planActuel,
  volumeMensuel,
}: {
  planActuel: Plan;
  /** Ce que la marque a versé en collaborations sur les 30 derniers jours. */
  volumeMensuel: number;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-ink">Abonnement</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Tout est accessible sans abonnement. Ce que l&apos;abonnement change,
        c&apos;est le taux de commission — rien d&apos;autre.
      </p>

      {volumeMensuel > 0 && (
        <p className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
          Tu as versé{" "}
          <strong className="text-ink">
            {volumeMensuel.toLocaleString("fr-FR")} €
          </strong>{" "}
          de collaborations ces 30 derniers jours.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {PLANS.map((p) => {
          const t = TARIFS[p];
          const commission = Math.round(volumeMensuel * t.tauxCollab);
          const coutTotal = commission + t.prix;
          const actuel = p === planActuel;
          return (
            <div
              key={p}
              className={`rounded-xl border p-4 ${
                actuel ? "border-purple-300 bg-purple-50/40" : "border-zinc-200"
              }`}
            >
              <p className="font-display text-lg font-black text-ink">{t.libelle}</p>
              <p className="text-sm text-zinc-500">
                {t.prix === 0 ? "Sans engagement" : `${t.prix} €/mois`}
              </p>
              <p className="mt-3 text-sm">
                <strong className="text-ink">
                  {Math.round(t.tauxCollab * 100)} %
                </strong>{" "}
                <span className="text-zinc-500">sur les collaborations</span>
              </p>
              <p className="text-sm">
                <strong className="text-ink">
                  {Math.round(t.tauxAffiliation * 100)} %
                </strong>{" "}
                <span className="text-zinc-500">sur l&apos;affiliation</span>
              </p>

              {volumeMensuel > 0 && (
                <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  Sur ton volume : {commission.toLocaleString("fr-FR")} € de
                  commission{t.prix > 0 ? ` + ${t.prix} € d'abonnement` : ""} ={" "}
                  <strong className="text-ink">
                    {coutTotal.toLocaleString("fr-FR")} €
                  </strong>
                </p>
              )}

              {actuel ? (
                <p className="mt-3 text-xs font-semibold text-purple-700">
                  ✓ Ton plan actuel
                </p>
              ) : p === "free" ? (
                <p className="mt-3 text-xs text-zinc-400">
                  Plan par défaut — aucune action requise.
                </p>
              ) : (
                <form action={souscrireAbonnement} className="mt-3">
                  <input type="hidden" name="plan" value={p} />
                  <button
                    type="submit"
                    className="w-full rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Passer à {t.libelle}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        Résiliable à tout moment depuis Stripe. Ton taux reste celui de ton plan
        jusqu&apos;au terme déjà réglé.
      </p>
    </div>
  );
}
