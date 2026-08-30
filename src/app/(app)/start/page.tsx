import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Routage post-login. Toutes les entrées (login form, callback email,
 * etc.) convergent ici. On regarde le rôle et on envoie l'utilisateur
 * vers SA marketplace, pas vers un dashboard générique.
 *
 * Pattern Collabstr / Aspire / Upfluence : le 1er écran après login
 * c'est la marketplace, pas un cockpit. Le dashboard reste accessible
 * via la sidebar pour les stats.
 */
export default async function StartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { role?: string | null; role_confirmed?: boolean } | null;
          }>;
        };
      };
    };
  })
    .from("profiles")
    .select("role, role_confirmed")
    .eq("id", user.id)
    .maybeSingle();

  // Un compte arrivé par Google n'a transmis aucun rôle : la base retombe sur
  // « créateur » faute de mieux. Tant que la personne ne l'a pas confirmé, on
  // ne l'envoie nulle part — on lui pose la question.
  if (profile && profile.role_confirmed === false) {
    redirect("/onboarding/role");
  }

  if (profile?.role === "brand") {
    // Marque → marketplace créateurs (= sa raison d'être sur Collabbs).
    redirect("/creators");
  }
  if (profile?.role === "creator") {
    // Créateur → opportunités (= sa raison d'être).
    redirect("/opportunities");
  }

  // Rôle inconnu / pas encore posé → dashboard fallback.
  redirect("/dashboard");
}
