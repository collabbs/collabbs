import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOnce } from "@/lib/notifications";
import { settleSale } from "@/lib/affiliate-billing";
import { limitByIp, tooManyRequests, RATE_POLICIES } from "@/lib/rate-limit";

// Postback de VENTE attribuée à un CODE PROMO.
// Sémantiquement proche de /api/track/sale mais résout par code promo
// au lieu du code de tracking d'affiliation. La commission est calculée
// selon campaigns.promo_commission_pct (un % dédié, vs le tier d'affiliation
// utilisé pour les ventes via lien tracké).
//
// Sécurité : la marque s'authentifie avec son secret (en-tête `Authorization:
// Bearer <secret>`, ou `key` dans le corps JSON en POST). Jamais dans l'URL :
//            un paramètre d'URL finit dans les journaux d'accès.
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
      "id, creator_id, campaigns(brand_id, promo_commission_pct, promo_min_purchase, promo_expires_at, brands(postback_secret))",
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

  // Les conditions posées par la marque n'étaient VÉRIFIÉES NULLE PART. Le
  // panier minimum et la date d'expiration s'affichaient au créateur — « dès
  // 50 € d'achat », « expire le 30/09 » — et le postback commissionnait quand
  // même une commande de 5 € reçue trois mois plus tard.
  //
  // On enregistre quand même la vente : elle a eu lieu, la marque doit la voir
  // et le créateur comprendre pourquoi elle ne lui rapporte rien. On l'écarte
  // avec sa raison, plutôt que de la faire disparaître.
  const minimum = Number(link.campaigns?.promo_min_purchase ?? 0);
  const expiration = link.campaigns?.promo_expires_at as string | null | undefined;
  let ecartee: string | null = null;
  if (minimum > 0 && amount < minimum) {
    ecartee = `Panier de ${amount} € inférieur au minimum de ${minimum} € fixé par la marque`;
  } else if (expiration && new Date(expiration).getTime() < Date.now()) {
    ecartee = `Code expiré le ${new Date(expiration).toLocaleDateString("fr-FR")}`;
  }

  const pct = link.campaigns?.promo_commission_pct ?? 0;
  // Au centime : on manipule désormais de l'argent réellement versé.
  const commission = Math.round(amount * pct) / 100;

  const { data: inserted, error } = await supabase
    .from("affiliate_events")
    .insert({
      link_id: link.id,
      type: "sale",
      // Non financée tant que la réservation sur la provision n'a pas abouti.
      status: ecartee ? "rejected" : "unfunded",
      source: "promo_code",
      sale_amount: amount,
      commission_amount: ecartee ? 0 : commission,
      external_ref: p.externalRef,
      reject_reason: ecartee,
    })
    .select("id")
    .single();
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

  // Une vente écartée ne réserve rien : il n'y a pas de commission à couvrir.
  if (ecartee) {
    return NextResponse.json({
      ok: true,
      rejected: true,
      reason: ecartee,
      sale_amount: amount,
      commission: 0,
    });
  }

  // Réserve la commission + les frais Collabbs sur la provision de la marque.
  await settleSale({
    eventId: inserted.id,
    brandId: link.campaigns!.brand_id,
    creatorId: link.creator_id,
    commission,
    saleAmount: amount,
  });

  notifyOnce({
    userId: link.creator_id,
    type: "first_promo_sale",
    title: "🎟️ Première vente via ton code promo !",
    body: `Une vente de ${amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} vient d'être attribuée à ton code "${normalized}". Commission : ${commission.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}.`,
    link: "/opportunities",
  }).catch(() => {});

  return NextResponse.json({ ok: true, sale_amount: amount, rate: pct, commission });
}

/**
 * Plafond appliqué avant toute lecture en base : c'est l'essai du secret qu'on
 * veut rendre coûteux, pas la requête SQL qui suit.
 *
 * Seau distinct de `/api/track/sale` : un pic de ventes ne doit pas fermer la
 * porte aux codes promo, et inversement.
 */
async function limite(request: Request) {
  const verdict = await limitByIp(request, "track:promo", RATE_POLICIES.postback);
  return verdict.allowed ? null : tooManyRequests(verdict.retryAfter);
}

export async function GET(request: Request) {
  const refus = await limite(request);
  if (refus) return refus;

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
  const refus = await limite(request);
  if (refus) return refus;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const secret = extractSecret(request, (body.key as string) ?? null);
  return handle({
    code: (body.code as string) ?? null,
    amount: body.amount != null ? String(body.amount) : null,
    externalRef: (body.order_id as string) ?? null,
    secret,
  });
}
