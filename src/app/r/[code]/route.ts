import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    .select("id, campaigns(target_url, brands(website))")
    .eq("code", code)
    .maybeSingle();

  if (!link) {
    return NextResponse.redirect(`${origin}/`, 302);
  }

  // Enregistre le clic (RLS bypassée par le service-role).
  await supabase.from("affiliate_events").insert({ link_id: link.id, type: "click" });

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
