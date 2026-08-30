import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Contrôle d'accès à l'administration.
 *
 * Une seule porte, vérifiée côté serveur à chaque page et à chaque action.
 * Le drapeau `is_admin` ne donne aucun privilège via la RLS : il autorise
 * uniquement le code serveur à employer le service_role, après cette
 * vérification. Un utilisateur qui parviendrait à modifier son propre profil
 * n'obtiendrait donc rien de plus.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  // Page inexistante plutôt qu'« accès refusé » : inutile de signaler
  // l'existence d'une administration à quelqu'un qui n'y a pas droit.
  if (!(profile as { is_admin?: boolean } | null)?.is_admin) redirect("/dashboard");

  return { userId: user.id };
}

/** Variante non redirigeante, pour masquer l'entrée de menu aux non-admins. */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return Boolean((data as { is_admin?: boolean } | null)?.is_admin);
}
