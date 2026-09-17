/**
 * Rafraîchissement de la session Supabase, appelé par le proxy (ex-middleware en Next 16).
 * Revalide le token à chaque requête et propage les cookies mis à jour.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT : ne rien insérer entre createServerClient et getUser().
  // getUser() revalide le token d'authentification auprès de Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* ─── La porte d'entrée ne redemande pas de s'inscrire ───────────────────
     L'accueil est le questionnaire d'acquisition : « présente ta marque »,
     champs vides, bouton grisé. Écrit pour quelqu'un qui n'a pas de compte.
     Un client déjà inscrit qui tape collabbs.com — ou qui y arrive par un lien
     — tombait dessus lui aussi, et se voyait proposer de tout resaisir alors
     que son profil est complet depuis des semaines.

     La redirection est faite ICI plutôt que dans la page : l'accueil est
     statique et indexé, et y ajouter une lecture de session le rendrait
     dynamique pour TOUS les visiteurs, y compris ceux qui ne sont pas
     connectés. Le proxy, lui, lit déjà la session à chaque requête.

     `/start` aiguille ensuite selon le rôle. La chaîne de requête est
     conservée : un `?ref=` posé par un créateur ne doit pas se perdre. */
  if (user && request.nextUrl.pathname === "/") {
    const versApp = request.nextUrl.clone();
    versApp.pathname = "/start";
    return NextResponse.redirect(versApp);
  }

  return supabaseResponse;
}
