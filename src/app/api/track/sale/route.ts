import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOnce } from "@/lib/notifications";
import { settleSale } from "@/lib/affiliate-billing";

// Postback de VENTE attribuée à un lien d'affiliation.
// Sécurité : la marque s'authentifie avec son secret (en-tête `Authorization: Bearer <secret>`,
//            ou en repli ?key=<secret> dans l'URL pour les intégrations très simples).
// Idempotence : si la même `order_id` (champ `external_ref`) est postée 2 fois pour le
//            même lien, la 2e tentative est ignorée silencieusement (pas de double commission).
//
// Appel attendu côté boutique de la marque, depuis le SERVEUR (pas le navigateur) :
//   POST /api/track/sale
//   Authorization: Bearer <postback_secret de la marque>
//   { "code": "<ref capté par votre cookie>", "amount": 49.99, "order_id": "ORD-12345" }

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
    return NextResponse.json({ ok: false, error: "code et amount requis" }, { status: 400 });
  }
  const amount = Number(p.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "amount invalide" }, { status: 400 });
  }
  if (!p.secret) {
    return NextResponse.json({ ok: false, error: "secret manquant" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("affiliate_links")
    .select(
      "id, creator_id, campaigns(brand_id, commission_nano, commission_micro, commission_mid, commission_macro, brands(postback_secret))",
    )
    .eq("code", p.code)
    .maybeSingle();
  if (!link) {
    return NextResponse.json({ ok: false, error: "lien introuvable" }, { status: 404 });
  }

  const brandSecret = link.campaigns?.brands?.postback_secret;
  if (!brandSecret || !constantTimeEqual(p.secret, brandSecret)) {
    return NextResponse.json({ ok: false, error: "secret invalide" }, { status: 401 });
  }

  // Palier de commission = plus grande audience renseignée par le créateur.
  const { data: platforms } = await supabase
    .from("creator_platforms")
    .select("subscribers")
    .eq("creator_id", link.creator_id);
  const subs = Math.max(0, ...(platforms ?? []).map((x) => x.subscribers ?? 0));

  const c = link.campaigns;
  let rate = 0;
  if (c) {
    if (subs >= 200000) rate = c.commission_macro ?? 0;
    else if (subs >= 50000) rate = c.commission_mid ?? 0;
    else if (subs >= 10000) rate = c.commission_micro ?? 0;
    else rate = c.commission_nano ?? 0;
  }
  // Au centime : on manipule désormais de l'argent réellement versé.
  const commission = Math.round((amount * rate)) / 100;

  const { data: inserted, error } = await supabase
    .from("affiliate_events")
    .insert({
      link_id: link.id,
      type: "sale",
      // Authentifiée par le secret de la marque : ce chemin est digne de
      // confiance, il règle automatiquement. Voir la migration 0042.
      source: "postback",
      // Non financée tant que la réservation sur la provision n'a pas abouti.
      status: "unfunded",
      sale_amount: amount,
      commission_amount: commission,
      external_ref: p.externalRef,
    })
    .select("id")
    .single();
  if (error) {
    // Unique violation → vente déjà enregistrée pour ce order_id → succès idempotent.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({
        ok: true,
        deduplicated: true,
        sale_amount: amount,
        rate,
        commission,
      });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Réserve la commission + les frais Collabbs sur la provision de la marque.
  // C'est ce qui transforme une ligne de statistique en argent réellement dû.
  const settlement = await settleSale({
    eventId: inserted.id,
    brandId: link.campaigns!.brand_id,
    creatorId: link.creator_id,
    commission,
    saleAmount: amount,
  });

  // Notification 1ʳᵉ fois : première vente affiliée de toute la vie du créateur.
  notifyOnce({
    userId: link.creator_id,
    type: "first_affiliate_sale",
    title: "🎉 Ta première vente affiliée !",
    body: `Une vente de ${amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} vient d'être attribuée à ton lien. Commission : ${commission.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}. Bienvenue dans le revenu passif.`,
    link: "/opportunities",
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    sale_amount: amount,
    rate,
    commission,
    status: settlement,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Pas de repli `?key=` ici : un secret en paramètre d'URL est écrit dans les
  // journaux d'accès de Vercel, des CDN et de tout intermédiaire. Une fuite de
  // journaux donnerait le pouvoir de fabriquer des ventes. L'en-tête
  // `Authorization: Bearer <secret>` est la seule voie en GET.
  const secret = extractSecret(request, null);
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
