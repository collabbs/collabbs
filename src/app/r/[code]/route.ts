import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOnce } from "@/lib/notifications";
import { limitByIp, tooManyRequests, RATE_POLICIES, clientIp } from "@/lib/rate-limit";

/**
 * Empreinte non réversible d'un visiteur, propre à un lien.
 *
 * Sert uniquement à ne pas compter deux fois le même clic. Le HMAC est signé
 * par un secret serveur et inclut l'identifiant du lien : impossible de
 * recouper un même visiteur d'une marque à l'autre, ni de remonter à son IP.
 * C'est ce que la politique de confidentialité annonce.
 */
function visitorHash(request: Request, linkId: string): string | null {
  const secret = process.env.COLLABBS_POSTBACK_SECRET;
  if (!secret) return null; // pas de secret → pas d'empreinte, on compte tout
  // Même règle que pour la limitation de débit : on ne lit jamais l'adresse
  // que l'appelant DÉCLARE. Prendre le premier élément de `x-forwarded-for`
  // rendait la déduplication des clics contournable — il suffisait de changer
  // l'en-tête à chaque appel pour gonfler le compteur d'un créateur.
  const ip = clientIp(request.headers) ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  if (!ip && !ua) return null;
  return createHmac("sha256", secret).update(`${linkId}|${ip}|${ua}`).digest("hex");
}

// Redirection trackée d'un lien d'affiliation : /r/{code}
// → enregistre un clic (affiliate_events) puis redirige vers la destination.
export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  // Un humain qui clique ne dépasse jamais ce plafond. Ce qu'on arrête, c'est
  // la boucle qui gonfle le compteur de clics d'un créateur — et, accessoirement,
  // la lecture en base que chaque appel déclenche.
  const verdict = await limitByIp(request, "redirect", RATE_POLICIES.redirect);
  if (!verdict.allowed) return tooManyRequests(verdict.retryAfter);

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

  // Enregistre le clic, en ne comptant qu'une fois par visiteur, par lien et
  // par jour. L'index unique fait le travail : un doublon lève une erreur qu'on
  // ignore volontairement — la redirection doit aboutir quoi qu'il arrive.
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const clickRes = await (supabase as any).from("affiliate_events").insert({
    link_id: link.id,
    type: "click",
    visitor_hash: visitorHash(request, link.id),
    click_day: new Date().toISOString().slice(0, 10),
  });
  const isNewClick = !clickRes.error;

  // Notification 1ʳᵉ fois : premier clic affilié de toute la vie du créateur.
  // Seulement sur un vrai clic — pas sur un rafraîchissement.
  if (isNewClick) {
    notifyOnce({
      userId: link.creator_id,
      type: "first_affiliate_click",
      title: "🎉 Ton lien a eu son premier clic !",
      body: "Quelqu'un vient de cliquer sur l'un de tes liens d'affiliation. La machine est lancée — chaque vente derrière te rapportera ta commission automatiquement.",
      link: "/opportunities",
    }).catch(() => {
      /* non bloquant pour la redirection */
    });
  }

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
