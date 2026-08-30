import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ContractSnapshot } from "@/lib/contract-snapshot";
import { buildContractDocument } from "@/lib/contract-template";
import ContractActions from "../ContractActions";
import ContractView, { dateTimeFr } from "../ContractView";

export const metadata = { title: "Contrat — Collabbs" };

/**
 * Le contrat, lisible et imprimable.
 *
 * Rendu à partir du `terms_snapshot` figé à la signature — jamais des données
 * actuelles. Si une partie change d'adresse demain, le contrat signé garde
 * l'adresse du jour de la signature : c'est tout l'intérêt d'un contrat.
 */

export default async function ContractPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: deal } = await supabase
    .from("deals")
    .select("id, brand_id, creator_id")
    .eq("id", dealId)
    .maybeSingle();
  // La RLS restreint déjà aux deux parties, mais on vérifie explicitement :
  // un contrat n'est lisible que par ceux qui l'ont signé.
  if (!deal || (deal.brand_id !== user.id && deal.creator_id !== user.id)) notFound();

  const { data: contract } = await supabase
    .from("contracts")
    .select("reference, status, terms_snapshot, brand_signed_at, creator_signed_at, terminated_at")
    .eq("deal_id", dealId)
    .maybeSingle();
  if (!contract) notFound();

  const snapshot = contract.terms_snapshot as ContractSnapshot | null;
  if (!snapshot) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-black text-ink">
          Contrat pas encore établi
        </h1>
        <p className="mt-2 text-zinc-600">
          Le contrat est figé au moment où le créateur accepte la collaboration.
          Celle-ci est encore en négociation.
        </p>
      </div>
    );
  }

  // Les contrats signés avant juin 2026 ont un snapshot d'ancien format : les
  // termes du deal, sans les coordonnées des parties (les infos légales
  // n'existaient pas encore). On ne peut pas en faire un contrat conforme, et
  // on ne va sûrement pas en inventer le contenu — on affiche honnêtement ce
  // qu'on a.
  if (snapshot.version !== 1) {
    const legacy = snapshot as unknown as {
      title?: string;
      amount?: number;
      format?: string;
      quantity?: number;
    };
    return (
      <>
        <ContractActions
          reference={contract.reference}
          backHref={`/deals/${dealId}`}
          backLabel="Retour à la collaboration"
          pdfHref={`/contracts/${dealId}/pdf`}
          canExport={false}
        />
        <article className="mx-auto max-w-3xl px-6 py-10 sm:px-10">
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-400">
            Contrat archivé
          </p>
          <h1 className="mt-2 font-display text-2xl font-black text-ink">
            {legacy.title ?? "Collaboration"}
          </h1>
          <p className="mt-1 font-mono text-sm text-zinc-500">{contract.reference}</p>

          <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Ce contrat a été signé avant la mise en place du format actuel. Il
            conserve les termes convenus et les signatures horodatées, mais pas les
            coordonnées légales des parties — elles n&apos;étaient pas encore
            collectées à l&apos;époque. Il ne satisfait donc pas aux mentions
            obligatoires introduites au 1<sup>er</sup> janvier 2026.
          </p>

          <dl className="mt-6 divide-y divide-zinc-100 rounded-2xl border border-zinc-100">
            {[
              ["Montant", legacy.amount != null ? `${legacy.amount} €` : "—"],
              ["Format", legacy.format ?? "—"],
              ["Quantité", legacy.quantity != null ? String(legacy.quantity) : "—"],
              ["Signé par la marque", dateTimeFr(contract.brand_signed_at)],
              ["Signé par le créateur", dateTimeFr(contract.creator_signed_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </article>
      </>
    );
  }

  const doc = buildContractDocument({
    reference: contract.reference,
    snapshot,
    regime: snapshot.regime ?? "complete",
  });

  const terminated = Boolean(contract.terminated_at);

  return (
    <>
      <ContractActions
        reference={contract.reference}
        backHref={`/deals/${dealId}`}
        backLabel="Retour à la collaboration"
        pdfHref={`/contracts/${dealId}/pdf`}
      />
      <ContractView
        doc={doc}
        eyebrow="Contrat de collaboration commerciale"
        brandSignedAt={contract.brand_signed_at}
        creatorSignedAt={contract.creator_signed_at}
        notice={
          <>
            {doc.regime === "simplified" && (
              <p className="mt-4 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600 print:border print:border-zinc-300">
                <strong className="font-semibold text-ink">Forme simplifiée.</strong> La
                rémunération cumulée entre ces deux parties sur l&apos;année civile
                n&apos;atteint pas 1 000 € HT, seuil à partir duquel la loi impose un
                contrat écrit détaillé.
              </p>
            )}
            {terminated && (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                Contrat résilié le {dateTimeFr(contract.terminated_at)}.
              </p>
            )}
          </>
        }
      />
    </>
  );
}
