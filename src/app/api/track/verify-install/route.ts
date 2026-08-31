import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { verifierUrlPublique, MAX_REDIRECTIONS } from "@/lib/url-publique";

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

  // ─── Pourquoi tout ce protocole pour un simple fetch ───
  // L'URL vient de la marque, et n'importe qui peut créer un compte marque.
  // Sans contrôle, inscrire `http://169.254.169.254/` comme site web faisait
  // interroger le réseau interne par notre propre serveur, et le message
  // d'erreur ci-dessous renvoyait le code HTTP obtenu : de quoi cartographier
  // ce qui écoute. Voir `lib/url-publique`.
  //
  // Les redirections sont suivies À LA MAIN parce que valider seulement
  // l'adresse saisie ne protège de rien : un domaine parfaitement ordinaire
  // peut répondre 302 vers une adresse interne. Chaque saut est revalidé.
  let html = "";
  let cible = url;
  try {
    for (let saut = 0; ; saut++) {
      const verdict = await verifierUrlPublique(cible);
      if (!verdict.ok) {
        return NextResponse.json({
          ok: false,
          reason: "invalid_url",
          message:
            verdict.raison === "dns"
              ? "On n'a pas pu résoudre l'adresse de ton site."
              : "Cette adresse ne peut pas être vérifiée : indique l'URL publique de ta boutique.",
        });
      }

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(verdict.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Collabbs Verifier) AppleWebKit/537.36 (KHTML, like Gecko)",
        },
        signal: controller.signal,
        redirect: "manual",
      });
      clearTimeout(t);

      const suivante = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (suivante) {
        if (saut >= MAX_REDIRECTIONS) {
          return NextResponse.json({
            ok: false,
            reason: "too_many_redirects",
            message: "Ton site enchaîne trop de redirections pour qu'on puisse le vérifier.",
          });
        }
        // `new URL(x, base)` résout aussi bien un `/chemin` qu'une URL entière.
        cible = new URL(suivante, verdict.url).toString();
        continue;
      }

      if (!res.ok)
        return NextResponse.json({
          ok: false,
          reason: "fetch_failed",
          message: `Ton site a répondu ${res.status} — vérifie qu'il est en ligne.`,
        });
      html = await res.text();
      break;
    }
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

  if (hasScript && hasBrand) {
    // Persiste la vérif réussie sur la marque (lecture cheap par /tracking et dashboard).
    try {
      const admin = createAdminClient();
      await admin
        .from("brands")
        .update({ tracking_verified_at: new Date().toISOString() })
        .eq("id", brand.id);
      revalidatePath("/tracking");
      revalidatePath("/dashboard");
    } catch {
      // l'utilisateur a quand même son résultat affiché — on ne bloque pas dessus
    }
    return NextResponse.json({ ok: true, installed: true, url });
  }
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
