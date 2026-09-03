import Link from "next/link";
import { SITE } from "@/lib/legal-entity";
import { buildContractDocument } from "@/lib/contract-template";
import { snapshotModele, REFERENCE_MODELE } from "@/lib/modele-contrat";
import ContractView from "@/app/(app)/contracts/ContractView";

export const metadata = {
  title: "Modèle de contrat influenceur conforme au décret 2025-1137",
  description:
    "Le contrat écrit est obligatoire dès 1 000 € HT cumulés dans l'année avec une même marque. Modèle gratuit reprenant toutes les mentions rendues obligatoires par le décret n° 2025-1137. À copier, compléter et imprimer.",
  alternates: { canonical: `${SITE.url}/outils/modele-contrat` },
  openGraph: {
    title: "Modèle de contrat influenceur — décret 2025-1137",
    description:
      "Toutes les mentions obligatoires, en clair. Gratuit, sans compte.",
    url: `${SITE.url}/outils/modele-contrat`,
    type: "website",
  },
};

/**
 * Le modèle que la loi rend nécessaire et que personne ne fournit.
 *
 * Le décret impose le contrat écrit au-delà de 1 000 €, mais n'impose à
 * personne de le mettre à disposition. Aucune des plateformes concurrentes
 * étudiées ne le propose. C'est la contrepartie offerte par l'outil de suivi
 * du seuil — et une page qui se référence toute seule sur une requête que des
 * créateurs tapent forcément à partir de janvier.
 *
 * Le document vient du MÊME moteur que les contrats réels de la plateforme.
 * Un modèle qui divergerait du contrat que Collabbs émet vraiment serait pire
 * que pas de modèle du tout.
 */
export default function PageModeleContrat() {
  const doc = buildContractDocument({
    reference: REFERENCE_MODELE,
    snapshot: snapshotModele(),
    regime: "complete",
  });

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <Link href="/outils" className="text-sm font-medium text-zinc-500 hover:text-ink">
        ← Les outils
      </Link>

      <h1 className="font-display mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">
        Modèle de contrat de collaboration commerciale
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-zinc-600">
        Depuis le décret n° 2025-1137, un contrat écrit est obligatoire dès{" "}
        <strong className="text-ink">1 000 € HT cumulés sur l&apos;année civile</strong>{" "}
        avec un même annonceur, avantages en nature compris. Ce modèle reprend les
        mentions que le décret rend obligatoires. Il est gratuit, il n&apos;y a rien
        à créer et rien à laisser.
      </p>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
        <p>
          <strong>À lire avant de l&apos;utiliser.</strong>{" "}
          Ce modèle a été rédigé
          pour couvrir les mentions obligatoires du décret, mais il ne l&apos;a pas
          été par un professionnel du droit et ne remplace pas son avis. Les
          passages entre crochets sont à compléter. Selon la collaboration,
          d&apos;autres clauses peuvent être nécessaires — exclusivité, droits
          d&apos;usage, cession d&apos;image.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/outils/seuil-1000-euros"
          className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Suivre mon cumul par marque
        </Link>
        <Link
          href="/signup?role=creator"
          className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-zinc-50"
        >
          Les faire générer automatiquement
        </Link>
      </div>

      <div className="mt-10">
        <ContractView
          doc={doc}
          eyebrow="Modèle — contrat de collaboration commerciale"
          brandSignedAt={null}
          creatorSignedAt={null}
          unsignedLabel="Signature et date"
          notice={
            <p className="text-sm leading-relaxed text-zinc-600">
              <strong className="text-ink">Document vierge.</strong> Remplacez
              chaque passage entre crochets par vos informations et celles de
              l&apos;annonceur. Les deux parties doivent conserver un exemplaire signé.
            </p>
          }
        />
      </div>
    </main>
  );
}
