"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  clientIp,
  identityKey,
  RATE_POLICIES,
} from "@/lib/rate-limit";

/**
 * Refuse la tentative si l'un des seaux est vide, et dit combien de temps
 * attendre.
 *
 * Deux dimensions, parce qu'elles arrêtent deux attaques différentes : l'IP
 * arrête celui qui essaie mille mots de passe sur un compte, l'email arrête
 * celui qui essaie le même mot de passe sur mille comptes depuis mille
 * machines. Aucune des deux seule ne suffit.
 *
 * Une action serveur répond par une redirection, pas par un code HTTP : le 429
 * n'a pas de destinataire ici, on renvoie l'utilisateur sur son formulaire avec
 * un message lisible.
 */
async function attenteRequise(cles: (string | null)[]): Promise<number | null> {
  for (const cle of cles) {
    const verdict = await checkRateLimit(cle, RATE_POLICIES.auth);
    if (!verdict.allowed) return verdict.retryAfter;
  }
  return null;
}

/** « 45 secondes », « 3 minutes » — pour un message, pas pour un en-tête. */
function delaiLisible(secondes: number): string {
  if (secondes < 60) return `${secondes} seconde${secondes > 1 ? "s" : ""}`;
  const minutes = Math.ceil(secondes / 60);
  return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}

/** Adresse IP de l'appelant, telle que la plateforme la transmet. */
async function ipAppelant(): Promise<string | null> {
  return clientIp(await headers());
}

/** Connexion par email + mot de passe. */
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const ip = await ipAppelant();
  const attente = await attenteRequise([
    ip ? `auth:login:${ip}` : null,
    identityKey("auth:login:email", email),
  ]);
  if (attente) {
    redirect(
      `/login?error=${encodeURIComponent(
        `Trop de tentatives de connexion. Réessaie dans ${delaiLisible(attente)}.`,
      )}`,
    );
  }

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

  // Chaque inscription déclenche un email de confirmation : sans plafond, la
  // route sert de canon à spam au nom de Collabbs, et notre domaine finit
  // signalé.
  const ip = await ipAppelant();
  const attente = await attenteRequise([ip ? `auth:signup:${ip}` : null]);
  if (attente) {
    redirect(
      `/signup?error=${encodeURIComponent(
        `Trop d'inscriptions depuis cette connexion. Réessaie dans ${delaiLisible(attente)}.`,
      )}`,
    );
  }

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

  // Le seau par email est le vrai garde-fou ici : sans lui, n'importe qui noie
  // la boîte mail de n'importe qui sous des courriers de réinitialisation.
  //
  // En cas de dépassement on redirige quand même vers `?sent=1`, comme le
  // chemin normal : dire « trop de tentatives pour cette adresse » révélerait
  // qu'elle est visée, et le silence sur l'existence des comptes est
  // précisément ce que cette fonction protège.
  const ip = await ipAppelant();
  const attente = await attenteRequise([
    ip ? `auth:reset:${ip}` : null,
    identityKey("auth:reset:email", email),
  ]);
  if (attente) redirect("/reset?sent=1");

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
