import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cheminInterne } from "@/lib/redirection";

/**
 * Callback de confirmation email / OAuth.
 * Supabase redirige ici avec un `code` qu'on échange contre une session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Default = /start qui dispatch vers la marketplace adaptée au rôle.
  // Même filtre qu'à l'inscription : le lien de confirmation part par
  // e-mail, donc `next` est modifiable par quiconque relaie ce lien.
  const next = cheminInterne(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Lien de confirmation invalide ou expiré.")}`,
  );
}
