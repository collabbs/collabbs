import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildAffiliateContractDocument,
  type AffiliateContractSnapshot,
} from "@/lib/contract-template";
import { renderContractPdf } from "@/lib/contract-pdf";

// Le contrat-cadre d'affiliation en PDF, généré à la demande depuis
// l'instantané figé. Rien n'est stocké : l'instantané est l'archive, et
// régénérer donne toujours exactement le même document.
//
// @react-pdf/renderer a besoin du runtime Node (pas Edge).
export const runtime = "nodejs";


export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "non connecté" }, { status: 401 });
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "kind, reference, terms_snapshot, brand_id, creator_id, brand_signed_at, creator_signed_at, terminated_at",
    )
    .eq("id", id)
    .maybeSingle();

  // Un contrat ne se télécharge que par ses parties.
  if (
    !contract ||
    contract.kind !== "affiliate" ||
    (contract.brand_id !== user.id && contract.creator_id !== user.id)
  ) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const snapshot = contract.terms_snapshot as AffiliateContractSnapshot | null;
  if (!snapshot || snapshot.version !== 1) {
    return NextResponse.json(
      { error: "Ce contrat ne peut pas être exporté en PDF." },
      { status: 409 },
    );
  }

  try {
    const doc = buildAffiliateContractDocument({
      reference: contract.reference,
      snapshot,
    });
    const pdf = await renderContractPdf({
      doc,
      brandSignedAt: contract.brand_signed_at,
      creatorSignedAt: contract.creator_signed_at,
      terminatedAt: contract.terminated_at,
      eyebrow: `Contrat-cadre d'affiliation · ${snapshot.period_year}`,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Contrat-cadre-${contract.reference}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[affiliate-contract-pdf] génération impossible", err);
    return NextResponse.json(
      { error: "Le PDF n'a pas pu être généré." },
      { status: 500 },
    );
  }
}
