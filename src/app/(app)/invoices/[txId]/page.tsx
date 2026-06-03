import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEGAL_STATUSES } from "@/app/(app)/profile/legal-utils";
import PrintButton from "./PrintButton";

export const metadata = {
  title: "Facture — Collabbs",
};

const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function statusLabel(id: string | null): string {
  if (!id) return "—";
  return LEGAL_STATUSES.find((s) => s.id === id)?.label ?? id;
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ txId: string }>;
}) {
  const { txId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Récup transaction (RLS s'occupe de filtrer aux parties autorisées)
  const { data: tx } = await supabase
    .from("transactions")
    .select(
      "id, type, deal_id, brand_id, creator_id, gross_amount, net_amount, platform_fee, platform_fee_rate, status, paid_at, created_at, reference",
    )
    .eq("id", txId)
    .maybeSingle();
  if (!tx) notFound();

  // Sécurité : seules la marque ET le créateur du deal voient la facture
  if (tx.brand_id !== user.id && tx.creator_id !== user.id) notFound();

  // Récup deal + parties via admin (besoin des coordonnées légales complètes)
  const admin = createAdminClient();
  const [dealRes, brandLegalRes, creatorLegalRes, brandProfileRes, creatorProfileRes, brandRow, creatorRow] =
    await Promise.all([
      tx.deal_id
        ? admin
            .from("deals")
            .select("id, title, amount, format, quantity, deadline, created_at")
            .eq("id", tx.deal_id)
            .single()
        : Promise.resolve({ data: null }),
      tx.brand_id
        ? admin
            .from("legal_info")
            .select("status, legal_name, rep_name, address, city, zip, country, siret, vat, contact_email")
            .eq("user_id", tx.brand_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("legal_info")
        .select("status, legal_name, rep_name, address, city, zip, country, siret, vat, contact_email")
        .eq("user_id", tx.creator_id)
        .maybeSingle(),
      tx.brand_id
        ? admin.from("profiles").select("display_name").eq("id", tx.brand_id).single()
        : Promise.resolve({ data: null }),
      admin.from("profiles").select("display_name").eq("id", tx.creator_id).single(),
      tx.brand_id
        ? admin.from("brands").select("name, website").eq("id", tx.brand_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("creators").select("handle").eq("id", tx.creator_id).maybeSingle(),
    ]);

  const deal = dealRes.data;
  const brandLegal = brandLegalRes.data;
  const creatorLegal = creatorLegalRes.data;
  const brandProfile = brandProfileRes.data;
  const creatorProfile = creatorProfileRes.data;
  const brandRowData = brandRow.data;
  const creatorRowData = creatorRow.data;

  // Numéro de facture lisible : YYYYMM-XXXX (4 derniers chars du tx id)
  const txShort = tx.id.slice(-4).toUpperCase();
  const dateRef = new Date(tx.created_at);
  const invoiceNumber = `${dateRef.getFullYear()}${String(dateRef.getMonth() + 1).padStart(2, "0")}-${txShort}`;
  const issueDate = dateRef.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Émetteur/destinataire dépendent du type de transaction
  // - deal_payment : facture des frais de plateforme émise par Collabbs à la marque
  // - affiliate_payout : facture du créateur à la marque pour ses commissions
  // Pour l'instant on traite tout de la même façon : la marque a payé, on lui
  // fournit le justificatif d'achat avec la commission Collabbs détaillée.

  const brandName = brandRowData?.name ?? brandProfile?.display_name ?? "Marque";
  const creatorName =
    creatorProfile?.display_name ??
    (creatorRowData?.handle ? `@${creatorRowData.handle}` : "Créateur");

  return (
    <div className="print:p-0">
      <PrintButton invoiceNumber={invoiceNumber} />

      <article className="invoice-page mx-auto max-w-3xl rounded-lg bg-white p-8 shadow-lg print:max-w-none print:rounded-none print:p-0 print:shadow-none sm:p-12">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-zinc-200 pb-6">
          <div>
            <p className="font-display text-3xl font-black tracking-tight text-ink">
              collab<span className="text-purple-600">b</span>
              <span className="text-pink-500">s</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Marketplace créateurs × marques
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
              Collabbs SAS · 75002 Paris, France
              <br />
              SIRET — · contact@collabbs.com
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-black tracking-tight text-ink">
              Facture
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-ink">
              N° {invoiceNumber}
            </p>
            <p className="text-xs text-zinc-500">Émise le {issueDate}</p>
            {tx.paid_at && (
              <p className="mt-2 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                ✓ Réglée
              </p>
            )}
          </div>
        </header>

        {/* Parties */}
        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-100 bg-zinc-50/40 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Émetteur
            </p>
            <p className="mt-2 text-sm font-bold text-ink">{creatorLegal?.legal_name ?? creatorName}</p>
            {creatorLegal?.status && (
              <p className="text-xs text-zinc-500">{statusLabel(creatorLegal.status)}</p>
            )}
            {creatorLegal && (
              <div className="mt-2 text-xs leading-relaxed text-zinc-600">
                {creatorLegal.address && <div>{creatorLegal.address}</div>}
                {(creatorLegal.zip || creatorLegal.city) && (
                  <div>
                    {creatorLegal.zip} {creatorLegal.city}
                  </div>
                )}
                {creatorLegal.country && <div>{creatorLegal.country}</div>}
              </div>
            )}
            {creatorLegal?.siret && (
              <p className="mt-2 text-[11px] text-zinc-500">SIRET : {creatorLegal.siret}</p>
            )}
            {creatorLegal?.vat && (
              <p className="text-[11px] text-zinc-500">TVA : {creatorLegal.vat}</p>
            )}
            {creatorLegal?.contact_email && (
              <p className="mt-1 text-[11px] text-zinc-500">{creatorLegal.contact_email}</p>
            )}
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50/40 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Destinataire
            </p>
            <p className="mt-2 text-sm font-bold text-ink">{brandLegal?.legal_name ?? brandName}</p>
            {brandLegal?.status && (
              <p className="text-xs text-zinc-500">{statusLabel(brandLegal.status)}</p>
            )}
            {brandLegal?.rep_name && (
              <p className="text-xs text-zinc-500">Représentant : {brandLegal.rep_name}</p>
            )}
            {brandLegal && (
              <div className="mt-2 text-xs leading-relaxed text-zinc-600">
                {brandLegal.address && <div>{brandLegal.address}</div>}
                {(brandLegal.zip || brandLegal.city) && (
                  <div>
                    {brandLegal.zip} {brandLegal.city}
                  </div>
                )}
                {brandLegal.country && <div>{brandLegal.country}</div>}
              </div>
            )}
            {brandLegal?.siret && (
              <p className="mt-2 text-[11px] text-zinc-500">SIRET : {brandLegal.siret}</p>
            )}
            {brandLegal?.vat && (
              <p className="text-[11px] text-zinc-500">TVA : {brandLegal.vat}</p>
            )}
            {brandLegal?.contact_email && (
              <p className="mt-1 text-[11px] text-zinc-500">{brandLegal.contact_email}</p>
            )}
          </div>
        </section>

        {/* Lignes facture */}
        <section className="mt-8">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-200">
                <th className="pb-2 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Description
                </th>
                <th className="pb-2 text-right text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-100">
                <td className="py-3 align-top">
                  <p className="font-medium text-ink">
                    {deal?.title ?? "Collaboration Collabbs"}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {deal?.format ? `Format : ${deal.format}` : ""}
                    {deal?.quantity ? ` · Quantité : ${deal.quantity}` : ""}
                  </p>
                  {tx.reference && (
                    <p className="mt-1 font-mono text-[10px] text-zinc-400">
                      Réf. {tx.reference}
                    </p>
                  )}
                </td>
                <td className="py-3 text-right align-top font-medium text-ink">
                  {eur(tx.gross_amount)}
                </td>
              </tr>
              <tr className="border-b border-zinc-100">
                <td className="py-3 text-xs text-zinc-500">
                  Commission Collabbs ({(tx.platform_fee_rate * 100).toFixed(0)} %)
                </td>
                <td className="py-3 text-right text-xs text-zinc-500">
                  − {eur(tx.platform_fee)}
                </td>
              </tr>
              <tr>
                <td className="pt-4 text-sm font-bold uppercase tracking-wide text-ink">
                  Total reversé au créateur
                </td>
                <td className="pt-4 text-right font-display text-xl font-black text-ink">
                  {eur(tx.net_amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Pied */}
        <footer className="mt-12 border-t border-zinc-200 pt-4 text-[10px] leading-relaxed text-zinc-500">
          <p>
            Document généré automatiquement par Collabbs. TVA non applicable —
            art. 293 B du CGI (à adapter selon le statut juridique des parties).
          </p>
          <p className="mt-2">
            En cas de question : <strong>support@collabbs.com</strong>
          </p>
        </footer>
      </article>

      <style>{`
        @media print {
          body { background: white !important; }
          .invoice-page { box-shadow: none !important; max-width: 100% !important; }
          @page { margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
