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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

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
