import { NextResponse } from "next/server";
import { stripe, ensureCheckoutSessionRecorded } from "@/lib/stripe";
import { handleTopupCheckout } from "@/lib/affiliate-billing";

// Retour de Stripe Checkout : enregistre la transaction en séquestre via le
// helper partagé. La même logique tourne aussi côté webhook, donc si le
// navigateur ferme l'onglet, le paiement est quand même enregistré.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return NextResponse.redirect(`${url.origin}/deals`, 302);

  let dealId: string | undefined;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Approvisionnement de la provision d'affiliation : autre destination.
    if (session.metadata?.kind === "topup") {
      const res = await handleTopupCheckout(session);
      return NextResponse.redirect(
        `${url.origin}/billing?${res.ok ? "topup=1" : "topuperror=1"}`,
        302,
      );
    }

    const res = await ensureCheckoutSessionRecorded(session);
    dealId = res.dealId ?? (session.metadata?.deal_id as string | undefined);
  } catch {
    if (dealId) return NextResponse.redirect(`${url.origin}/deals/${dealId}?payerror=1`, 302);
    return NextResponse.redirect(`${url.origin}/deals`, 302);
  }

  if (!dealId) return NextResponse.redirect(`${url.origin}/deals`, 302);
  return NextResponse.redirect(`${url.origin}/deals/${dealId}?paid=1`, 302);
}
