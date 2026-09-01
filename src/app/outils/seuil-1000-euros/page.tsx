import Link from "next/link";
import { SITE } from "@/lib/legal-entity";
import SuiviSeuil from "./SuiviSeuil";

export const metadata = {
  title: "Suivi du seuil de 1 000 € — contrat influenceur obligatoire",
  description:
    "Depuis janvier 2026, un contrat écrit est obligatoire dès 1 000 € HT cumulés dans l'année avec une même marque, produits offerts compris. Suivez votre cumul marque par marque. Gratuit, sans compte, rien ne quitte votre navigateur.",
  alternates: { canonical: `${SITE.url}/outils/seuil-1000-euros` },
  openGraph: {
    title: "Suivi du seuil légal de 1 000 €",
    description:
      "Le cumul se fait par marque et par année, avantages en nature compris. Suivez-le sans compte.",
    url: `${SITE.url}/outils/seuil-1000-euros`,
    type: "website",
  },
};

/**
 * L'outil le plus stratégique du produit, et le moins spectaculaire.
 *
 * ─── Pourquoi lui ───
 * Les contrôles de la DGCCRF visent les CRÉATEURS, pas les marques : environ
 * 260 par an, dont 40 à 50 % en anomalie. La pression réglementaire s'exerce
 * donc là où personne ne vend d'outil. Et ce cumul est, littéralement, un
 * travail de comptabilité que personne ne fait à la main correctement — par
 * couple marque × créateur, sur l'année, argent et cadeaux additionnés.
 *
 * ─── Ce qu'il fabrique ───
 * Le besoin auquel Collabbs répond. Un créateur qui découvre qu'il a dépassé
 * le seuil avec trois marques a un problème dont la solution est exactement
 * notre produit. Aucun concurrent français n'occupe ce terrain : Takema et
 * Moggo proposent des calculateurs de tarifs et des générateurs de brief, rien
 * sur le seuil ni sur le contrat.
 */
export default function PageSeuil() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <Link href="/outils" className="text-sm font-medium text-zinc-500 hover:text-ink">
        ← Les outils
      </Link>

      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-purple-600">
        Outil gratuit, sans compte
      </p>
      <h1 className="mt-2 font-display text-4xl font-black leading-tight tracking-tight text-ink sm:text-5xl">
        Où en es-tu du seuil de 1&nbsp;000&nbsp;€&nbsp;?
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600">
        Depuis le 1<sup>er</sup> janvier 2026, un contrat écrit est obligatoire dès que le
        cumul dépasse 1 000 € HT dans l&apos;année avec une même marque —{" "}
        <strong className="font-semibold text-ink">produits offerts compris</strong>. Le
        compteur se tient par marque, et c&apos;est précisément ce que personne ne suit à
        la main.
      </p>

      <SuiviSeuil />

      <section className="mt-14">
        <h2 className="font-display text-2xl font-black tracking-tight text-ink">
          Ce que dit exactement le texte
        </h2>
        <div className="mt-4 space-y-4 text-[17px] leading-relaxed text-zinc-600">
          <p>
            L&apos;article 1<sup>er</sup> du décret n° 2025-1137 du 28 novembre 2025 impose
            le contrat écrit lorsque « la somme des rémunérations versées et de la valeur
            des avantages en nature accordés à un influenceur par un annonceur au cours de
            la même année en contrepartie d&apos;une prestation ou d&apos;un ensemble de
            prestations d&apos;influence commerciale par voie électronique poursuivant un
            même objectif promotionnel est supérieure ou égale à un montant de 1 000 euros
            hors taxes ».
          </p>
          <p>
            Trois choses s&apos;y cachent, et presque aucun article de vulgarisation ne les
            mentionne toutes. Le cumul se fait{" "}
            <strong className="font-semibold text-ink">par annonceur</strong>, pas sur
            l&apos;ensemble de tes revenus. Les{" "}
            <strong className="font-semibold text-ink">avantages en nature</strong> comptent
            pour leur valeur, au même titre que l&apos;argent. Et il ne vise que les
            prestations{" "}
            <strong className="font-semibold text-ink">« poursuivant un même objectif
            promotionnel »</strong> : deux campagnes réellement distinctes s&apos;apprécient
            séparément.
          </p>
          <p>
            Cette dernière frontière n&apos;a été tranchée par aucun juge. Cet outil cumule
            donc tout par marque, ce qui est plus strict que le texte — parce que se croire
            en dessous coûte beaucoup plus cher que de se croire au-dessus.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-black tracking-tight text-ink">
          Pourquoi ça te concerne plus que la marque
        </h2>
        <div className="mt-4 space-y-4 text-[17px] leading-relaxed text-zinc-600">
          <p>
            La responsabilité est{" "}
            <strong className="font-semibold text-ink">solidaire</strong> : l&apos;absence de
            contrat engage l&apos;annonceur, l&apos;agent et le créateur. Mais dans les
            faits, les contrôles de la DGCCRF visent les créateurs — environ 260 par an, dont
            40 à 50 % se révèlent en anomalie.
          </p>
          <p>
            Demander un contrat n&apos;est donc plus une exigence inconfortable à formuler
            auprès d&apos;une marque. C&apos;est la loi, et c&apos;est toi qu&apos;on
            contrôle.
          </p>
        </div>
      </section>

      <div className="mt-12 rounded-3xl border border-zinc-100 bg-zinc-50 p-6 text-center">
        <p className="font-display text-lg font-black text-ink">
          Sur Collabbs, le contrat s&apos;écrit tout seul
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
          Le cumul est suivi automatiquement par marque, avantages en nature compris, et le
          contrat conforme est généré et signé par les deux parties avant la prestation. Le
          paiement est bloqué en séquestre avant que tu tournes. Gratuit pour les créateurs.
        </p>
        <Link
          href="/signup"
          className="mt-5 inline-block rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
        >
          Créer mon profil gratuitement
        </Link>
      </div>

      <p className="mt-8 text-center text-sm text-zinc-500">
        À lire aussi :{" "}
        <Link href="/blog/contrat-influenceur-obligatoire-2026" className="underline underline-offset-2 hover:text-ink">
          ce que la loi impose depuis janvier 2026
        </Link>{" "}
        et{" "}
        <Link href="/blog/avantages-en-nature-seuil-legal-influence" className="underline underline-offset-2 hover:text-ink">
          pourquoi les produits offerts comptent
        </Link>.
      </p>
    </main>
  );
}
