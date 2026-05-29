import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Enregistre une VENTE attribuée à un lien d'affiliation + calcule la commission
// selon le palier d'abonnés du créateur.
// Démo : GET /api/track/sale?code=XXX&amount=50
// Prod : à appeler en POST depuis la page "merci" de la marque (postback serveur).
async function handle(code: string | null, amountRaw: string | null) {
  if (!code || !amountRaw) {
    return NextResponse.json({ ok: false, error: "code et amount requis" }, { status: 400 });
  }
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "amount invalide" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("affiliate_links")
    .select(
      "id, creator_id, campaigns(commission_nano, commission_micro, commission_mid, commission_macro)",
    )
    .eq("code", code)
    .maybeSingle();
  if (!link) {
    return NextResponse.json({ ok: false, error: "lien introuvable" }, { status: 404 });
  }

  // Palier du créateur = sa plus grande audience renseignée
  const { data: platforms } = await supabase
    .from("creator_platforms")
    .select("subscribers")
    .eq("creator_id", link.creator_id);
  const subs = Math.max(0, ...(platforms ?? []).map((p) => p.subscribers ?? 0));

  const c = link.campaigns;
  let rate = 0;
  if (c) {
    if (subs >= 200000) rate = c.commission_macro ?? 0;
    else if (subs >= 50000) rate = c.commission_mid ?? 0;
    else if (subs >= 10000) rate = c.commission_micro ?? 0;
    else rate = c.commission_nano ?? 0;
  }
  const commission = Math.round((amount * rate) / 100);

  const { error } = await supabase.from("affiliate_events").insert({
    link_id: link.id,
    type: "sale",
    sale_amount: amount,
    commission_amount: commission,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sale_amount: amount, rate, commission });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handle(url.searchParams.get("code"), url.searchParams.get("amount"));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const code = (body.code as string) ?? null;
  const amount = body.amount != null ? String(body.amount) : null;
  return handle(code, amount);
}
