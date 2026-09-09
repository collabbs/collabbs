import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ContractSnapshot } from "@/lib/contract-snapshot";
import { buildContractDocument } from "@/lib/contract-template";
import { renderContractPdf } from "@/lib/contract-pdf";

/**
 * Le PDF d'un contrat dont l'autre partie a supprimé son compte.
 *
 * La route habituelle passe par le deal — et le deal, lui, a disparu avec le
 * compte. Sans cette route, l'archive serait un tiroir que personne ne peut
 * ouvrir : on aurait conservé la preuve pour se donner bonne conscience, et
 * elle serait restée illisible.
 *
 * Le document est identique à celui d'avant : c'est le même `terms_snapshot`,
 * figé à la signature, passé au même générateur. Rien n'est reconstitué.
 */
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

  // La policy de `contrats_archives` limite déjà la lecture à `partie_id`.
  // Le filtre explicite est là quand même : une policy se modifie, une
  // condition écrite dans la requête se relit.
  const { data: archive } = await supabase
    .from("contrats_archives")
    .select(
      "reference, terms_snapshot, brand_signed_at, creator_signed_at, terminated_at, contrepartie_nom",
    )
    .eq("id", id)
    .eq("partie_id", user.id)
    .maybeSingle();

  if (!archive) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const snapshot = archive.terms_snapshot as ContractSnapshot | null;
  if (!snapshot || snapshot.version !== 1) {
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
      reference: archive.reference,
      snapshot,
      regime: snapshot.regime ?? "complete",
    });
    const pdf = await renderContractPdf({
      doc,
      brandSignedAt: archive.brand_signed_at,
      creatorSignedAt: archive.creator_signed_at,
      terminatedAt: archive.terminated_at,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Contrat-${archive.reference}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[contrat-archive-pdf] génération impossible", err);
    return NextResponse.json({ error: "Le PDF n'a pas pu être généré." }, { status: 500 });
  }
}
