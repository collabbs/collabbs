import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { dealBreakdown } from "@/lib/deal";

// Retour de Stripe Checkout : vérifie le paiement et enregistre la transaction
// en séquestre (in_escrow). Écriture backend (service-role) car la table
// transactions est interdite en écriture aux rôles anon/authenticated.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return NextResponse.redirect(`${url.origin}/deals`, 302);

  let dealId: string | undefined;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    dealId = session.metadata?.deal_id ?? undefined;
    if (!dealId) return NextResponse.redirect(`${url.origin}/deals`, 302);

    if (session.payment_status === "paid") {
      const admin = createAdminClient();
      const { data: existing } = await admin
        .from("transactions")
        .select("id")
        .eq("deal_id", dealId)
        .eq("type", "deal_payment")
        .maybeSingle();

      if (!existing) {
        const { data: deal } = await admin
          .from("deals")
          .select("brand_id, creator_id, amount")
          .eq("id", dealId)
          .single();
        if (deal) {
          const b = dealBreakdown(deal.amount);
          await admin.from("transactions").insert({
            type: "deal_payment",
            deal_id: dealId,
            brand_id: deal.brand_id,
            creator_id: deal.creator_id,
            gross_amount: b.gross,
            platform_fee_rate: 0.1,
            platform_fee: b.fee,
            net_amount: b.net,
            currency: "eur",
            status: "in_escrow",
            reference:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          });
        }
      }
    }
  } catch {
    if (dealId) return NextResponse.redirect(`${url.origin}/deals/${dealId}?payerror=1`, 302);
    return NextResponse.redirect(`${url.origin}/deals`, 302);
  }

  return NextResponse.redirect(`${url.origin}/deals/${dealId}?paid=1`, 302);
}
