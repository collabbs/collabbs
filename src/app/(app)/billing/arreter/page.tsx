import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estEchu } from "@/lib/temps";
import {
  TARIFS,
  planValide,
  comparaisonArret,
  limiteCampagnesActives,
} from "@/lib/tarifs";
import { volumeCollaborations30j } from "@/lib/volume-collaborations";
import { resilierMonAbonnement } from "../actions";

export const metadata = { title: "Arrêter mon abonnement — Collabbs" };

/**
 * L'écran d'arrêt.
 *
 * ─── Ce qu'il n'est pas ───
 * Ce n'est pas un parcours de rétention au sens habituel du terme : pas de
 * remise de dernière minute, pas de « es-tu VRAIMENT sûr » répété trois fois,
 * pas de bouton de confirmation caché en gris clair. Ces procédés retiennent
 * une facture un mois de plus et perdent le client pour de bon.
 *
 * ─── Ce qu'il est ───
 * Le calcul, fait honnêtement, avec les chiffres de la marque. Un abonnement
 * qui achète un taux se juge à l'arithmétique : ou bien il fait économiser de
 * l'argent à son volume actuel, et le lui montrer suffit à le garder ; ou bien
 * il lui en coûte, et le retenir par la friction serait lui voler un mois.
 *
 * On dit donc la vérité dans les deux sens — y compris « à ton volume, arrêter
 * est le bon calcul ». C'est ce qui rend crédible la phrase inverse quand elle
 * est vraie, et c'est ce qui fait revenir une marque qui grandit.
 *
 * Reste une chose qu'elle ignore peut-être et qu'on lui doit : le plafond de
 * campagnes simultanées. Ce n'est pas un argument de vente, c'est une
 * conséquence concrète qu'on ne peut pas la laisser découvrir après coup.
 */

const MOTIFS = [
  "Trop cher pour ce que ça me rapporte",
  "Je n'ai pas trouvé les bons créateurs",
  "Les résultats ne sont pas là",
  "Je mets mes campagnes en pause",
  "Je pars chez un concurrent",
];

const CARTE = "rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm";

export default async function ArreterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "brand") redirect("/dashboard");

  const admin = createAdminClient();
  const { data: brand } = await admin
    .from("brands")
    .select("plan, plan_expires_at, plan_cancel_at")
    .eq("id", user.id)
    .single();

  const plan = estEchu(brand?.plan_expires_at) ? "free" : planValide(brand?.plan);
  // Sans abonnement, cet écran n'a rien à dire.
  if (plan === "free") redirect("/billing");

  const tarif = TARIFS[plan];
  const volume = await volumeCollaborations30j(user.id);

  const { count } = await admin
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", user.id)
    .eq("status", "active");
  const actives = count ?? 0;
  const plafondGratuit = limiteCampagnesActives("free") ?? 2;

  // Le même mois, facturé des deux façons. Rien d'autre ne décide.
  const { coutActuel, coutGratuit, ecart, seuil } = comparaisonArret(plan, volume);

  const finLe = brand?.plan_cancel_at ?? brand?.plan_expires_at;
  const dateFin = finLe
    ? new Date(finLe).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/billing" className="text-sm text-zinc-500 hover:text-ink">
        ← Retour
      </Link>

      <h1 className="font-display mt-4 text-3xl font-black tracking-tight text-ink">
        Arrêter ton abonnement {tarif.libelle}
      </h1>

      {/* Ce qui se passe vraiment, tout de suite et en premier : c'est la
          question qui inquiète, et la laisser sans réponse fait cliquer par
          crainte plutôt que par choix. */}
      <div className={`${CARTE} mt-6`}>
        <h2 className="font-semibold text-ink">Ce qui se passe si tu arrêtes</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600">
          <li>
            <strong className="text-ink">Rien aujourd&apos;hui.</strong> Tu gardes
            ton taux {Math.round(tarif.tauxCollab * 100)} %
            {dateFin ? ` jusqu'au ${dateFin}` : " jusqu'au terme du mois déjà réglé"}.
          </li>
          <li>
            <strong className="text-ink">Tes campagnes continuent</strong>, toutes,
            y compris après. Une collaboration signée va à son terme et les
            créateurs sont payés normalement.
          </li>
          <li>
            <strong className="text-ink">Tes données restent.</strong> Contrats,
            messages, statistiques, liens d&apos;affiliation : rien n&apos;est
            effacé.
          </li>
          <li>Tu peux revenir quand tu veux, sans frais de reprise.</li>
        </ul>
      </div>

      {/* Le calcul, dans les deux sens. */}
      <div className={`${CARTE} mt-4`}>
        <h2 className="font-semibold text-ink">Ce que ça change pour toi</h2>

        {volume === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            Tu n&apos;as versé aucune collaboration ces 30 derniers jours, donc
            ton abonnement ne t&apos;a rien fait économiser : il t&apos;a coûté{" "}
            <strong className="text-ink">{tarif.prix} €</strong>. Tant que tu ne
            dépenses pas au moins{" "}
            <strong className="text-ink">
              {seuil?.toLocaleString("fr-FR")} € par mois
            </strong>
            , le plan Gratuit te revient moins cher. Arrêter est le bon calcul.
          </p>
        ) : (
          <>
            <table className="mt-3 w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                <tr>
                  <td className="py-2 text-zinc-600">
                    Ton mois en {tarif.libelle}
                  </td>
                  <td className="py-2 text-right tabular-nums text-zinc-500">
                    {Math.round(volume * tarif.tauxCollab).toLocaleString("fr-FR")} €
                    de commission + {tarif.prix} € ={" "}
                    <strong className="text-ink">
                      {coutActuel.toLocaleString("fr-FR")} €
                    </strong>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-zinc-600">Le même mois en Gratuit</td>
                  <td className="py-2 text-right tabular-nums text-zinc-500">
                    <strong className="text-ink">
                      {coutGratuit.toLocaleString("fr-FR")} €
                    </strong>{" "}
                    de commission, sans abonnement
                  </td>
                </tr>
              </tbody>
            </table>

            {ecart > 0 ? (
              <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
                À ton volume actuel, ton abonnement te coûte{" "}
                <strong className="text-ink">
                  {ecart.toLocaleString("fr-FR")} € de plus
                </strong>{" "}
                par mois qu&apos;il ne te fait économiser.{" "}
                <strong className="text-ink">Arrêter est le bon calcul.</strong>{" "}
                {tarif.libelle} devient intéressant à partir de{" "}
                {seuil?.toLocaleString("fr-FR")} € de collaborations par mois —
                reviens-y à ce moment-là.
              </p>
            ) : (
              <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                À ton volume actuel, ton abonnement te fait économiser{" "}
                <strong>{Math.abs(ecart).toLocaleString("fr-FR")} €</strong> par
                mois. En arrêtant, ta commission passera de{" "}
                {Math.round(tarif.tauxCollab * 100)} % à{" "}
                {Math.round(TARIFS.free.tauxCollab * 100)} %, et ce mois-ci
                t&apos;aurait coûté {coutGratuit.toLocaleString("fr-FR")} € au lieu
                de {coutActuel.toLocaleString("fr-FR")} €.
              </p>
            )}
          </>
        )}

        {/* La seule conséquence qui ne soit pas qu'une question d'argent. */}
        {actives > plafondGratuit && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            À savoir : tu as <strong>{actives} campagnes actives</strong>, et le
            plan Gratuit en autorise {plafondGratuit} en même temps. Elles
            continueront toutes — on ne ferme jamais une campagne ouverte — mais
            tu ne pourras plus en ouvrir de nouvelle tant que tu es au-dessus de{" "}
            {plafondGratuit}.
          </p>
        )}
      </div>

      {/* La question, posée une fois, sans champ obligatoire. */}
      <form action={resilierMonAbonnement} className={`${CARTE} mt-4`}>
        <h2 className="font-semibold text-ink">
          Qu&apos;est-ce qui te fait partir ?
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Facultatif, et ça ne change rien à ta résiliation. C&apos;est ce qui
          nous dit quoi corriger.
        </p>

        <div className="mt-3 space-y-2">
          {MOTIFS.map((m) => (
            <label
              key={m}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700 transition hover:border-zinc-300"
            >
              <input type="radio" name="motif" value={m} className="accent-purple-600" />
              {m}
            </label>
          ))}
        </div>

        <textarea
          name="commentaire"
          rows={3}
          maxLength={1000}
          placeholder="Si tu veux préciser (facultatif)"
          className="mt-3 w-full rounded-lg border border-zinc-200 p-3 text-sm outline-none focus:border-purple-400"
        />

        {/* L'ordre des deux boutons : garder à gauche et en plein, arrêter à
            droite et en sobre. Ce n'est pas un piège — le bouton d'arrêt est
            lisible, cliquable et libellé sans ambiguïté — c'est la hiérarchie
            normale entre l'action courante et l'action rare. */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/billing"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Garder mon plan {tarif.libelle}
          </Link>
          <button
            type="submit"
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-ink"
          >
            Confirmer l&apos;arrêt
          </button>
        </div>
      </form>
    </div>
  );
}
