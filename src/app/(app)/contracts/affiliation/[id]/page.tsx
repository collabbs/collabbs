import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildAffiliateContractDocument,
  type AffiliateContractSnapshot,
} from "@/lib/contract-template";
import ContractView from "../../ContractView";
import ContractActions from "../../ContractActions";
import { signAffiliateContract } from "./actions";

export const metadata = { title: "Contrat-cadre — Collabbs" };


/**
 * Le contrat-cadre d'affiliation, lisible et imprimable.
 *
 * Établi automatiquement quand le cumul annuel du couple franchit 1 000 €,
 * puis signé séparément par chaque partie — la relation étant déjà en cours,
 * il n'y a pas de moment d'acceptation commun comme pour une collaboration.
 */
export default async function AffiliateContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "id, kind, reference, status, terms_snapshot, brand_id, creator_id, period_year, brand_signed_at, creator_signed_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!contract || contract.kind !== "affiliate") notFound();
  if (contract.brand_id !== user.id && contract.creator_id !== user.id) notFound();

  const snapshot = contract.terms_snapshot as AffiliateContractSnapshot | null;
  if (!snapshot || snapshot.version !== 1) notFound();

  const doc = buildAffiliateContractDocument({
    reference: contract.reference,
    snapshot,
  });

  const estMarque = contract.brand_id === user.id;
  const maSignature = estMarque ? contract.brand_signed_at : contract.creator_signed_at;
  const signatureAutre = estMarque
    ? contract.creator_signed_at
    : contract.brand_signed_at;
  const complet = Boolean(contract.brand_signed_at && contract.creator_signed_at);

  return (
    <>
      <ContractActions
        reference={contract.reference}
        backHref="/contracts"
        backLabel="Tous les contrats"
        pdfHref={`/contracts/affiliation/${contract.id}/pdf`}
      >
        {!maSignature && (
          <form action={signAffiliateContract}>
            <input type="hidden" name="contractId" value={contract.id} />
            <button
              type="submit"
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Signer le contrat
            </button>
          </form>
        )}
        {maSignature && !complet && (
          <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            En attente de l&apos;autre partie
          </span>
        )}
        {complet && (
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            Signé par les deux parties
          </span>
        )}
      </ContractActions>

      <ContractView
        doc={doc}
        eyebrow={`Contrat-cadre d'affiliation · ${snapshot.period_year}`}
        brandSignedAt={contract.brand_signed_at}
        creatorSignedAt={contract.creator_signed_at}
        unsignedLabel="En attente de signature"
        notice={
          !complet ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 print:border print:border-zinc-300">
              <strong className="font-semibold">
                Ce contrat attend {signatureAutre || maSignature ? "une" : "deux"}{" "}
                signature
                {signatureAutre || maSignature ? "" : "s"}.
              </strong>{" "}
              Les rémunérations versées entre ces deux parties cette année
              dépassent 1 000 €, seuil à partir duquel la loi impose un contrat
              écrit. Les commissions déjà acquises restent dues et seront versées
              normalement — signer ne conditionne aucun paiement, c&apos;est une
              obligation des Parties entre elles.
            </p>
          ) : null
        }
      />
    </>
  );
}
