import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOnce } from "@/lib/notifications";

// Redirection trackée d'un lien d'affiliation : /r/{code}
// → enregistre un clic (affiliate_events) puis redirige vers la destination.
export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const origin = new URL(request.url).origin;
  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("affiliate_links")
    .select("id, creator_id, campaigns(target_url, brands(website))")
    .eq("code", code)
    .maybeSingle();

  if (!link) {
    return NextResponse.redirect(`${origin}/`, 302);
  }

  // Enregistre le clic (RLS bypassée par le service-role).
  await supabase.from("affiliate_events").insert({ link_id: link.id, type: "click" });

  // Notification 1ʳᵉ fois : premier clic affilié de toute la vie du créateur.
  notifyOnce({
    userId: link.creator_id,
    type: "first_affiliate_click",
    title: "🎉 Ton lien a eu son premier clic !",
    body: "Quelqu'un vient de cliquer sur l'un de tes liens d'affiliation. La machine est lancée — chaque vente derrière te rapportera ta commission automatiquement.",
    link: "/opportunities",
  }).catch(() => {
    /* non bloquant pour la redirection */
  });

  const raw =
    link.campaigns?.target_url || link.campaigns?.brands?.website || `${origin}/`;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  // Ajoute ?ref=<code> à l'URL de destination : la boutique de la marque pourra
  // lire ce paramètre, le stocker dans son propre cookie 1st-party (30 jours),
  // puis nous le renvoyer dans le postback de vente.
  let dest: URL;
  try {
    dest = new URL(normalized);
    dest.searchParams.set("ref", code);
  } catch {
    return NextResponse.redirect(`${origin}/`, 302);
  }

  return NextResponse.redirect(dest.toString(), 302);
}
