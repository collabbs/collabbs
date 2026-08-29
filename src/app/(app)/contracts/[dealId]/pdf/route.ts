import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ContractSnapshot } from "@/lib/contract-snapshot";
import { buildContractDocument } from "@/lib/contract-template";
import { renderContractPdf } from "@/lib/contract-pdf";

// Le contrat en PDF, généré à la demande depuis le snapshot figé à la
// signature. Rien n'est stocké : le snapshot est l'archive, et régénérer donne
// toujours exactement le même document.
//
// @react-pdf/renderer a besoin du runtime Node (pas Edge).
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "non connecté" }, { status: 401 });
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, creator_id")
    .eq("id", dealId)
    .maybeSingle();
  // Un contrat ne se télécharge que par ceux qui l'ont signé.
  if (!deal || (deal.brand_id !== user.id && deal.creator_id !== user.id)) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("reference, terms_snapshot, brand_signed_at, creator_signed_at, terminated_at")
    .eq("deal_id", dealId)
    .maybeSingle();
  if (!contract) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const snapshot = contract.terms_snapshot as ContractSnapshot | null;
  if (!snapshot || snapshot.version !== 1) {
    // Les contrats d'avant juin 2026 n'ont pas les coordonnées des parties :
    // on ne fabrique pas un PDF qui ferait croire à un contrat conforme.
    return NextResponse.json(
      {
        error:
          "Ce contrat a été signé avant la mise en place du format actuel et ne peut pas être exporté en PDF.",
      },
      { status: 409 },
    );
  }

  try {
    const doc = buildContractDocument({
      reference: contract.reference,
      snapshot,
      regime: snapshot.regime ?? "complete",
    });
    const pdf = await renderContractPdf({
      doc,
      brandSignedAt: contract.brand_signed_at,
      creatorSignedAt: contract.creator_signed_at,
      terminatedAt: contract.terminated_at,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Contrat-${contract.reference}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[contract-pdf] génération impossible", err);
    return NextResponse.json(
      { error: "Le PDF n'a pas pu être généré." },
      { status: 500 },
    );
  }
}
