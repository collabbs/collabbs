import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Vérifie qu'une marque connectée a bien installé le drop-in tracker sur son site.
// On fetch sa homepage côté serveur (pas de CORS) et on cherche notre script.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Non connecté." }, { status: 401 });

  const { data: brand } = await supabase
    .from("brands")
    .select("id, website")
    .eq("id", user.id)
    .single();
  if (!brand) return NextResponse.json({ ok: false, error: "Marque introuvable." });
  if (!brand.website)
    return NextResponse.json({
      ok: false,
      reason: "no_website",
      message: "Tu n'as pas encore renseigné le site de ta marque.",
    });

  const url = brand.website.startsWith("http") ? brand.website : `https://${brand.website}`;

  let html = "";
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Collabbs Verifier) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok)
      return NextResponse.json({
        ok: false,
        reason: "fetch_failed",
        message: `Ton site a répondu ${res.status} — vérifie qu'il est en ligne.`,
      });
    html = await res.text();
  } catch {
    return NextResponse.json({
      ok: false,
      reason: "unreachable",
      message: "On n'a pas pu joindre ton site (timeout ou bloqué).",
    });
  }

  const hasScript = /\/track\.js/i.test(html);
  const hasBrand = new RegExp(
    `data-brand\\s*=\\s*['"]${brand.id.replace(/[-]/g, "\\-")}['"]`,
    "i",
  ).test(html);

  if (hasScript && hasBrand)
    return NextResponse.json({ ok: true, installed: true, url });
  if (hasScript && !hasBrand)
    return NextResponse.json({
      ok: true,
      installed: false,
      reason: "wrong_brand",
      message:
        "Le script Collabbs est présent, mais le data-brand ne correspond pas à ton compte. Vérifie l'attribut.",
      url,
    });
  return NextResponse.json({
    ok: true,
    installed: false,
    reason: "not_found",
    message: "On n'a pas trouvé le script Collabbs sur ta page d'accueil. Vérifie qu'il est bien collé dans le <head>.",
    url,
  });
}
