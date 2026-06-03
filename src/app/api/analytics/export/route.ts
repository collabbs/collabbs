import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePeriod, periodRange } from "@/app/(app)/analytics/period";

/**
 * Export CSV des données analytics.
 * Query params :
 * - role : "creator" | "brand"
 * - period : "7d" | "30d" | "90d" | "ytd"
 * - kind : "transactions" | "affiliate_events"
 *
 * Sécurité : on filtre toujours par user.id, peu importe ce que dit role
 * dans l'URL. role sert juste à savoir quelle clé (creator_id vs brand_id).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const role = url.searchParams.get("role") === "brand" ? "brand" : "creator";
  const period = parsePeriod(url.searchParams.get("period") ?? undefined);
  const kind = url.searchParams.get("kind") === "affiliate_events"
    ? "affiliate_events"
    : "transactions";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { current } = periodRange(period, new Date());
  const startIso = current.start.toISOString();
  const endIso = current.end.toISOString();

  let csv = "";
  let filename = "";

  if (kind === "transactions") {
    const userKey = role === "brand" ? "brand_id" : "creator_id";
    const { data } = await supabase
      .from("transactions")
      .select("created_at, type, status, gross_amount, platform_fee, net_amount, currency, reference, deal_id")
      .eq(userKey, user.id)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false });

    const header = [
      "Date",
      "Type",
      "Statut",
      "Brut",
      "Commission Collabbs",
      "Net",
      "Devise",
      "Référence",
      "Deal ID",
    ];
    const rows = (data ?? []).map((r) => [
      new Date(r.created_at).toISOString(),
      r.type,
      r.status,
      String(r.gross_amount),
      String(r.platform_fee),
      String(r.net_amount),
      r.currency,
      r.reference ?? "",
      r.deal_id ?? "",
    ]);
    csv = toCsv([header, ...rows]);
    filename = `collabbs-transactions-${period}.csv`;
  } else {
    // affiliate_events : on récupère via les liens de l'user
    const linksRes =
      role === "brand"
        ? await supabase
            .from("affiliate_links")
            .select("id, campaign_id, creator_id, campaigns!inner(brand_id, name)")
            .eq("campaigns.brand_id", user.id)
        : await supabase
            .from("affiliate_links")
            .select("id, campaign_id, creator_id, campaigns(name)")
            .eq("creator_id", user.id);

    const links = linksRes.data ?? [];
    const linkIds = links.map((l) => l.id);
    if (linkIds.length === 0) {
      csv = toCsv([["Date", "Type", "Montant vente", "Commission", "Campagne", "Lien"]]);
    } else {
      const { data: events } = await supabase
        .from("affiliate_events")
        .select("created_at, type, sale_amount, commission_amount, link_id")
        .in("link_id", linkIds)
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .order("created_at", { ascending: false });

      const linkCampaign = new Map(
        links.map((l) => [l.id, l.campaigns?.name ?? l.campaign_id]),
      );

      const header = [
        "Date",
        "Type",
        "Montant vente",
        "Commission",
        "Campagne",
        "Lien",
      ];
      const rows = (events ?? []).map((e) => [
        new Date(e.created_at).toISOString(),
        e.type,
        e.sale_amount != null ? String(e.sale_amount) : "",
        e.commission_amount != null ? String(e.commission_amount) : "",
        linkCampaign.get(e.link_id) ?? "",
        e.link_id,
      ]);
      csv = toCsv([header, ...rows]);
    }
    filename = `collabbs-affiliation-${period}.csv`;
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}

function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(","),
    )
    .join("\n");
}
