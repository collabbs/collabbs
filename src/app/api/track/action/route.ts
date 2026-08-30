import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { settleSale } from "@/lib/affiliate-billing";
import { cpaTotalFor, cpaTierLabel, type CpaTier } from "@/lib/cpa";

// Postback d'ACTION attribuée à un lien d'affiliation (campagnes au CPA).
//
// Une « action » est ce que la marque a défini dans sa campagne : une
// inscription, un essai gratuit, un devis demandé. La marque est la seule à
// pouvoir la constater — elle seule voit l'inscription dans son système.
//
// Sécurité : la marque s'authentifie avec son secret (en-tête
//            `Authorization: Bearer <secret>`, ou `key` dans le corps JSON en
//            POST). Jamais dans l'URL : un paramètre d'URL finit dans les
//            journaux d'accès. Aucun repli sur le `Referer`, qui ne prouve
//            rien (voir la migration 0042).
// Idempotence : même `action_id` reposté pour le même lien → ignoré.
//
// Appel attendu depuis le SERVEUR de la marque :
//   POST /api/track/action
//   Authorization: Bearer <postback_secret>
//   { "code": "<ref du lien>", "action_id": "SIGNUP-8412", "count": 1 }

type Payload = {
  code: string | null;
  actionId: string | null;
  count: number;
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

const eur = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/* eslint-disable @typescript-eslint/no-explicit-any */

async function handle(p: Payload) {
  if (!p.code || !p.actionId) {
    return NextResponse.json(
      { ok: false, error: "code et action_id requis" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(p.count) || p.count < 1) {
    return NextResponse.json(
      { ok: false, error: "count doit être un entier positif" },
      { status: 400 },
    );
  }
  if (!p.secret) {
    return NextResponse.json({ ok: false, error: "secret manquant" }, { status: 401 });
  }

  const supabase: any = createAdminClient();

  const { data: link } = await supabase
    .from("affiliate_links")
    .select(
      "id, creator_id, campaign_id, campaigns(brand_id, type, cpa_value_per_action, cpa_action_label, brands(postback_secret))",
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

  const campaign = link.campaigns;
  if (campaign?.type !== "cpa_flat" && campaign?.type !== "cpa_tiers") {
    return NextResponse.json(
      { ok: false, error: "cette campagne n'est pas rémunérée à l'action" },
      { status: 409 },
    );
  }

  // L'événement est enregistré AVANT tout calcul : il est le fait constaté.
  // Sa commission est posée juste après, une fois le cumul connu.
  const { data: inserted, error } = await supabase
    .from("affiliate_events")
    .insert({
      link_id: link.id,
      type: "action",
      source: "cpa_action",
      action_count: p.count,
      // Statut posé juste après, une fois le crédit connu. On part de
      // « validée » plutôt que « non financée » : en paliers, la plupart des
      // actions ne rapportent rien tant qu'un seuil n'est pas franchi, et
      // rien n'est dû pour celles-là. Les marquer « non financées »
      // reviendrait à signaler une dette inexistante.
      status: "validated",
      commission_amount: 0,
      external_ref: p.actionId,
    })
    .select("id")
    .single();

  if (error) {
    // Index unique (link_id, external_ref) : la même action rejouée est un
    // succès silencieux, pas une erreur — et surtout pas un second paiement.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true, deduplicated: true });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Cumul et crédit se calculent sur TOUTES les actions du lien, pas sur la
  // seule déclaration qui vient d'arriver : c'est ce qui rend le calcul
  // auto-réparateur si une déclaration s'est perdue ou a été rejouée.
  const [{ data: evenements }, { data: tiers }] = await Promise.all([
    supabase
      .from("affiliate_events")
      .select("action_count")
      .eq("link_id", link.id)
      .eq("type", "action"),
    supabase
      .from("campaign_cpa_tiers")
      .select("min_actions, payout, label")
      .eq("campaign_id", link.campaign_id),
  ]);

  const lignes = (evenements ?? []) as { action_count: number | null }[];
  const cumul = lignes.reduce((n, e) => n + (e.action_count ?? 0), 0);

  // Total gagné au niveau atteint. La logique des paliers vit ici, en un seul
  // endroit, testée — la base ne fait que l'appliquer.
  const totalGagne = cpaTotalFor(campaign, (tiers ?? []) as CpaTier[], cumul);

  // Le crédit lui-même est atomique : `credit_cpa_action` verrouille les
  // actions du lien, relit ce qui a déjà été versé et n'écrit que l'écart.
  // Sans ce verrou, deux déclarations simultanées liraient la même somme et
  // créditeraient chacune le palier entier — un double paiement.
  const { data: credite, error: erreurCredit } = await supabase.rpc("credit_cpa_action", {
    p_link: link.id,
    p_event: inserted.id,
    p_total: totalGagne,
  });
  if (erreurCredit) {
    console.error("[track/action] credit_cpa_action a échoué", erreurCredit);
    return NextResponse.json(
      { ok: false, error: "crédit impossible" },
      { status: 500 },
    );
  }
  const commission = Number(credite ?? 0);

  // En paliers, des actions supplémentaires sans nouveau palier franchi ne
  // rapportent rien : l'événement reste enregistré à 0 €, ce qui est
  // exactement ce que l'interface annonce au créateur.
  if (commission > 0) {
    // `settleSale` pose le statut définitif : « pending » si la provision a
    // couvert, « unfunded » sinon.
    await settleSale({
      eventId: inserted.id,
      brandId: campaign.brand_id,
      creatorId: link.creator_id,
      commission,
      saleAmount: null,
    });

    const label = campaign.cpa_action_label || "action";
    const palier = cpaTierLabel((tiers ?? []) as CpaTier[], cumul);
    notify({
      userId: link.creator_id,
      type: "cpa_action_credited",
      title: palier ? `Palier « ${palier} » atteint !` : `Nouvelle ${label} créditée`,
      body: `${cumul} ${label}${cumul > 1 ? "s" : ""} au total sur ton lien. ${eur(commission)} viennent de s'ajouter à tes gains.`,
      link: "/payouts",
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    actions_declarees: p.count,
    actions_cumulees: cumul,
    commission,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Pas de repli `?key=` : un secret en paramètre d'URL est écrit dans les
  // journaux d'accès. L'en-tête `Authorization` est la seule voie en GET.
  return handle({
    code: url.searchParams.get("code"),
    actionId: url.searchParams.get("action_id"),
    count: Number(url.searchParams.get("count") ?? 1),
    secret: extractSecret(request, null),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return handle({
    code: (body.code as string) ?? null,
    actionId: (body.action_id as string) ?? null,
    count: body.count === undefined ? 1 : Number(body.count),
    secret: extractSecret(request, (body.key as string) ?? null),
  });
}
