import Link from "next/link";
import { SITE } from "@/lib/legal-entity";
import CalculateurDroits from "./CalculateurDroits";

export const metadata = {
  title: "Calculateur de droits d'usage UGC — combien facturer ?",
  description:
    "Payer une vidéo ne donne pas le droit de l'exploiter indéfiniment. Calculez ce que valent les droits d'usage selon la durée et le périmètre, avec les paliers réellement pratiqués. Gratuit, sans compte.",
  alternates: { canonical: `${SITE.url}/outils/droits-usage` },
  openGraph: {
    title: "Calculateur de droits d'usage UGC",
    description:
      "Ce que valent les droits d'usage d'une vidéo UGC, selon la durée et le périmètre. Gratuit, sans inscription.",
    url: `${SITE.url}/outils/droits-usage`,
    type: "website",
  },
};

/**
 * Le premier outil public de Collabbs.
 *
 * ─── Pourquoi une page, et pas une fonctionnalité ───
 * Une marketplace qui démarre n'a rien à montrer : pas de créateurs, pas de
 * campagnes, pas de preuve. Un outil, lui, rend service au premier visiteur,
 * seul, sans réseau et sans compte. C'est ce qu'a fait Collabstr avant d'être
 * une marketplace, et l'analyse des cent plus grandes marketplaces attribue à
 * cette stratégie une efficacité du capital dix fois supérieure aux autres.
 *
 * ─── Pourquoi celui-là ───
 * Parce que c'est le poste où un créateur perd le plus d'argent sans le savoir,
 * et parce que c'est le seul créneau vraiment vide : les calculateurs français
 * existants traitent les droits d'usage comme une case à cocher à trente euros.
 */
export default function PageDroitsUsage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <Link href="/outils" className="text-sm font-medium text-zinc-500 hover:text-ink">
        ← Les outils
      </Link>

      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-purple-600">
        Outil gratuit, sans compte
      </p>
      <h1 className="mt-2 font-display text-4xl font-black leading-tight tracking-tight text-ink sm:text-5xl">
        Combien valent les droits d&apos;usage&nbsp;?
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600">
        Payer une vidéo paie sa <strong className="font-semibold text-ink">fabrication</strong>.
        Le droit de la réutiliser ensuite — six mois sur le compte de la marque, ou pire,
        en publicité payante avec un budget média derrière — est autre chose, et vaut
        souvent davantage que la vidéo elle-même.
      </p>

      <CalculateurDroits />

      <section className="mt-14">
        <h2 className="font-display text-2xl font-black tracking-tight text-ink">
          Ce que ça change, concrètement
        </h2>
        <div className="mt-4 space-y-4 text-[17px] leading-relaxed text-zinc-600">
          <p>
            Un créateur facture 300 € une vidéo. La marque la trouve bonne, la passe en
            publicité payante et la diffuse pendant un an. Sans cession écrite, deux
            choses sont vraies en même temps : la marque n&apos;en avait pas le droit, et
            le créateur n&apos;a rien touché pour ça. Cette vidéo valait
            <strong className="font-semibold text-ink"> 780 €</strong>.
          </p>
          <p>
            C&apos;est le poste le plus souvent oublié d&apos;un devis UGC, et celui qui
            fait le plus de dégâts — parce qu&apos;il ne se voit pas au moment de la
            négociation, seulement des mois plus tard.
          </p>
          <p>
            Depuis le 1<sup>er</sup> janvier 2026, le contrat écrit est de toute façon
            obligatoire dès 1 000 € HT cumulés dans l&apos;année entre une marque et un
            créateur pour un même objectif promotionnel, avantages en nature compris. Et
            parmi les mentions imposées figurent précisément{" "}
            <strong className="font-semibold text-ink">les droits de propriété
            intellectuelle</strong>. Une cession non écrite n&apos;est plus seulement une
            perte d&apos;argent : c&apos;est un défaut de conformité.
          </p>
        </div>
      </section>

      <div className="mt-12 rounded-3xl border border-zinc-100 bg-zinc-50 p-6 text-center">
        <p className="font-display text-lg font-black text-ink">
          Sur Collabbs, la cession est écrite et payée
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
          La durée et le périmètre sont fixés avant la collaboration, le supplément est
          calculé automatiquement et versé au créateur en plus du prix du contenu, et le
          contrat le mentionne. Gratuit pour les créateurs.
        </p>
        <Link
          href="/signup"
          className="mt-5 inline-block rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
        >
          Créer un compte gratuitement
        </Link>
      </div>
    </main>
  );
}
