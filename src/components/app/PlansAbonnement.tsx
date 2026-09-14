import { TARIFS, PLANS, type Plan } from "@/lib/tarifs";
import Link from "next/link";
import {
  souscrireAbonnement,
  reprendreMonAbonnement,
} from "@/app/(app)/billing/actions";

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
  resiliationLe,
}: {
  planActuel: Plan;
  /** Ce que la marque a versé en collaborations sur les 30 derniers jours. */
  volumeMensuel: number;
  /** Fin programmée de l'abonnement, si la marque a demandé à s'arrêter. */
  resiliationLe?: string | null;
}) {
  const finProgrammee = resiliationLe
    ? new Date(resiliationLe).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

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

      {finProgrammee && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Ton abonnement s&apos;arrête le <strong>{finProgrammee}</strong>. D&apos;ici
          là rien ne change : tu gardes ton taux, tes campagnes et tes
          collaborations continuent. Ensuite tu repasses au plan Gratuit, sans
          rien perdre.
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

              {/* Sur un plan sans abonnement, l'addition n'a qu'un seul terme :
                  écrire « 52 € de commission = 52 € » donne un total qui semble
                  faux, sur la carte même qu'on quitte pour payer. */}
              {volumeMensuel > 0 && (
                <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  Sur ton volume :{" "}
                  {t.prix > 0 ? (
                    <>
                      {commission.toLocaleString("fr-FR")} € de commission +{" "}
                      {t.prix.toLocaleString("fr-FR")} € d&apos;abonnement ={" "}
                      <strong className="text-ink">
                        {coutTotal.toLocaleString("fr-FR")} €
                      </strong>
                    </>
                  ) : (
                    <>
                      <strong className="text-ink">
                        {commission.toLocaleString("fr-FR")} €
                      </strong>{" "}
                      de commission, sans abonnement
                    </>
                  )}
                </p>
              )}

              {actuel ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-purple-700">
                    ✓ Ton plan actuel
                  </p>
                  {/* Arrêter doit se faire là où on a souscrit. Renvoyer la
                      marque « vers Stripe » sans lien, c'est lui demander
                      d'écrire à quelqu'un pour cesser de payer. */}
                  {p !== "free" &&
                    (finProgrammee ? (
                      <form action={reprendreMonAbonnement} className="mt-2">
                        <button
                          type="submit"
                          className="text-xs font-semibold text-purple-700 underline underline-offset-2"
                        >
                          Reprendre mon abonnement
                        </button>
                      </form>
                    ) : (
                      // Vers un écran, pas vers une résiliation immédiate : on
                      // ne laisse pas un clic seul annuler un abonnement sans
                      // avoir dit ce qui s'arrête et ce qui continue.
                      <Link
                        href="/billing/arreter"
                        className="mt-2 inline-block text-xs text-zinc-500 underline underline-offset-2 transition hover:text-ink"
                      >
                        Arrêter mon abonnement
                      </Link>
                    ))}
                </div>
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
        Résiliable à tout moment, ici même. L&apos;arrêt prend effet à la fin du
        mois déjà réglé — tu gardes ton taux jusque-là.
      </p>
    </div>
  );
}
