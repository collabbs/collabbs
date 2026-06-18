import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOnce } from "@/lib/notifications";

// Postback de VENTE attribuée à un CODE PROMO.
// Sémantiquement proche de /api/track/sale mais résout par code promo
// au lieu du code de tracking d'affiliation. La commission est calculée
// selon campaigns.promo_commission_pct (un % dédié, vs le tier d'affiliation
// utilisé pour les ventes via lien tracké).
//
// Sécurité : la marque s'authentifie avec son secret (en-tête `Authorization:
// Bearer <secret>`, ou en repli ?key=<secret> dans l'URL).
// Idempotence : si la même `order_id` est postée 2 fois pour le même
// lien (et même source=promo_code), la 2e tentative est ignorée.
//
// Appel attendu côté boutique de la marque, depuis le SERVEUR :
//   POST /api/track/promo
//   Authorization: Bearer <postback_secret>
//   { "code": "MARTIN20", "amount": 49.99, "order_id": "ORD-12345" }

type Payload = {
  code: string | null;
  amount: string | null;
  externalRef: string | null;
  secret: string;
};

function extractSecret(req: Request, fallback: string | null): string {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  return (fallback ?? "").trim();
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function handle(p: Payload) {
  if (!p.code || !p.amount) {
    return NextResponse.json(
      { ok: false, error: "code et amount requis" },
      { status: 400 },
    );
  }
  const amount = Number(p.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "amount invalide" }, { status: 400 });
  }
  if (!p.secret) {
    return NextResponse.json({ ok: false, error: "secret manquant" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Résolution par promo_code (normalisé en upper pour matcher la saisie
  // case-insensitive côté checkout marque).
  const normalized = p.code.toUpperCase().replace(/\s+/g, "");
  const { data: link } = await supabase
    .from("affiliate_links")
    .select(
      "id, creator_id, campaigns(promo_commission_pct, brands(postback_secret))",
    )
    .eq("promo_code", normalized)
    .maybeSingle();
  if (!link) {
    return NextResponse.json(
      { ok: false, error: "code promo introuvable" },
      { status: 404 },
    );
  }

  const brandSecret = link.campaigns?.brands?.postback_secret;
  if (!brandSecret || !constantTimeEqual(p.secret, brandSecret)) {
    return NextResponse.json({ ok: false, error: "secret invalide" }, { status: 401 });
  }

  const pct = link.campaigns?.promo_commission_pct ?? 0;
  const commission = Math.round((amount * pct) / 100);

  const { error } = await supabase.from("affiliate_events").insert({
    link_id: link.id,
    type: "sale",
    source: "promo_code",
    sale_amount: amount,
    commission_amount: commission,
    external_ref: p.externalRef,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({
        ok: true,
        deduplicated: true,
        sale_amount: amount,
        rate: pct,
        commission,
      });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  notifyOnce({
    userId: link.creator_id,
    type: "first_promo_sale",
    title: "🎟️ Première vente via ton code promo !",
    body: `Une vente de ${amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} vient d'être attribuée à ton code "${normalized}". Commission : ${commission.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}.`,
    link: "/opportunities",
  }).catch(() => {});

  return NextResponse.json({ ok: true, sale_amount: amount, rate: pct, commission });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = extractSecret(request, url.searchParams.get("key"));
  return handle({
    code: url.searchParams.get("code"),
    amount: url.searchParams.get("amount"),
    externalRef: url.searchParams.get("order_id"),
    secret,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const secret = extractSecret(request, (body.key as string) ?? null);
  return handle({
    code: (body.code as string) ?? null,
    amount: body.amount != null ? String(body.amount) : null,
    externalRef: (body.order_id as string) ?? null,
    secret,
  });
}
