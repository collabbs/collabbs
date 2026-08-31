import { NextResponse } from "next/server";
import { stripe, ensureCheckoutSessionRecorded } from "@/lib/stripe";
import { handleTopupCheckout } from "@/lib/affiliate-billing";
import { enregistrerAbonnement } from "@/lib/abonnement-stripe";

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

    // Abonnement : on l'enregistre ici ET au webhook. Si l'onglet se ferme,
    // le webhook rattrape ; si le webhook tarde, le retour a déjà fait le
    // travail. Écrire deux fois le même plan ne change rien.
    if (session.metadata?.kind === "abonnement") {
      const res = await enregistrerAbonnement(session);
      return NextResponse.redirect(
        `${url.origin}/billing?${res.ok ? "abonnement=1" : "error=Abonnement+non+enregistr%C3%A9"}`,
        302,
      );
    }

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
    // Paiement encaissé mais non enregistré : la marque doit l'apprendre ici,
    // sinon elle revient sur une page qui affiche toujours « À régler ».
    if (!res.ok && dealId) {
      return NextResponse.redirect(`${url.origin}/deals/${dealId}?payerror=1`, 302);
    }
  } catch {
    if (dealId) return NextResponse.redirect(`${url.origin}/deals/${dealId}?payerror=1`, 302);
    return NextResponse.redirect(`${url.origin}/deals`, 302);
  }

  if (!dealId) return NextResponse.redirect(`${url.origin}/deals`, 302);
  return NextResponse.redirect(`${url.origin}/deals/${dealId}?paid=1`, 302);
}
