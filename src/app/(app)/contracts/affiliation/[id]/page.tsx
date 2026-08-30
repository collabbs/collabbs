import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  buildAffiliateContractDocument,
  type AffiliateContractSnapshot,
} from "@/lib/contract-template";
import ContractView from "../../ContractView";
import { signAffiliateContract } from "./actions";

export const metadata = { title: "Contrat-cadre — Collabbs" };

/* eslint-disable @typescript-eslint/no-explicit-any */

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

  const { data: contract } = await (supabase as any)
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
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-6 py-4 backdrop-blur print:hidden sm:px-10">
        <div className="min-w-0">
          <Link
            href="/contracts"
            className="text-sm font-medium text-zinc-500 hover:text-ink"
          >
            ← Tous les contrats
          </Link>
          <p className="font-mono text-xs text-zinc-400">{contract.reference}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!maSignature && (
            <form action={signAffiliateContract}>
              <input type="hidden" name="contractId" value={contract.id} />
              <button
                type="submit"
                className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Signer le contrat
              </button>
            </form>
          )}
          {maSignature && !complet && (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              En attente de l&apos;autre partie
            </span>
          )}
          {complet && (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
              Signé par les deux parties
            </span>
          )}
        </div>
      </div>

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
