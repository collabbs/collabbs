"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/** Connexion par email + mot de passe. */
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  // /start dispatch vers /creators (marque) ou /opportunities (créateur).
  redirect("/start");
}

/** Inscription : crée le compte avec rôle + nom (lus par le trigger handle_new_user). */
export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  const role = roleRaw === "brand" ? "brand" : "creator";
  const next = String(formData.get("next") ?? "").trim();

  const origin = (await headers()).get("origin") ?? "";

  // Si l'utilisateur vient d'une page d'amorçage (ex. /c/[id]), on lui fait
  // refaire ce chemin après confirmation email.
  const callbackUrl = next
    ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    : `${origin}/auth/callback`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl,
      data: { role, display_name: displayName },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/signup?success=1");
}

/** Déconnexion. */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * Demande un email de réinitialisation de mot de passe.
 * Pour ne PAS révéler si un email existe, on redirige toujours vers la même page de succès,
 * succès ou pas.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/reset?error=Email%20requis");

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });
  redirect("/reset?sent=1");
}

/** Met à jour le mot de passe de l'utilisateur connecté (post recovery link). */
export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8)
    redirect("/auth/update-password?error=" + encodeURIComponent("Mot de passe trop court (8 caractères min.)."));
  if (password !== confirm)
    redirect("/auth/update-password?error=" + encodeURIComponent("Les mots de passe ne correspondent pas."));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=" + encodeURIComponent("Lien expiré, redemande un email."));

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/auth/update-password?error=" + encodeURIComponent(error.message));

  revalidatePath("/", "layout");
  redirect("/dashboard?reset=1");
}
