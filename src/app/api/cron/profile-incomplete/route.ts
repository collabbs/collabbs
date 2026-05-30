import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOnce } from "@/lib/notifications";

// Tourne tous les jours : pour chaque user inscrit il y a entre 24h et 48h
// dont le profil est encore incomplet, envoie UNE notif de rappel.
// notifyOnce garantit qu'on n'envoie jamais 2 fois.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const until = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, role, avatar_url")
    .gte("created_at", since)
    .lte("created_at", until);

  let sent = 0;
  for (const p of profiles ?? []) {
    if (p.role === "creator") {
      const [{ count: nicheCount }, { count: offerCount }] = await Promise.all([
        admin.from("creator_niches").select("*", { count: "exact", head: true }).eq("creator_id", p.id),
        admin.from("creator_offers").select("*", { count: "exact", head: true }).eq("creator_id", p.id),
      ]);
      const complete = Boolean(p.avatar_url) && (nicheCount ?? 0) > 0 && (offerCount ?? 0) > 0;
      if (complete) continue;
      const ok = await notifyOnce({
        userId: p.id,
        type: "profile_incomplete_reminder",
        title: "Termine ton profil pour apparaître dans les recherches 👀",
        body: "Sans photo, niche et offre renseignées, ton profil reste caché aux marques. 3 minutes et c'est plié.",
        link: "/onboarding/creator",
      });
      if (ok) sent += 1;
    } else if (p.role === "brand") {
      const { data: brand } = await admin
        .from("brands")
        .select("logo_url, sector")
        .eq("id", p.id)
        .single();
      const complete = Boolean(brand?.logo_url) && Boolean(brand?.sector);
      if (complete) continue;
      const ok = await notifyOnce({
        userId: p.id,
        type: "profile_incomplete_reminder",
        title: "Renseigne ta marque pour inspirer confiance 🏢",
        body: "Logo, secteur et site : les 3 trucs que les créateurs regardent en premier. 2 minutes pour gagner en crédibilité.",
        link: "/onboarding/brand",
      });
      if (ok) sent += 1;
    }
  }

  return NextResponse.json({ ok: true, checked: profiles?.length ?? 0, sent });
}
