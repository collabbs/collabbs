"use server";

import { revalidatePath } from "next/cache";
import { echecEcriture } from "@/lib/echec-ecriture";
import { normaliserSiteMarque } from "@/lib/site-marque";
import { createClient } from "@/lib/supabase/server";
import { citySlug } from "@/lib/city";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OfferId } from "@/components/landing/creators";
import { validerImage } from "@/lib/image-televersee";

/**
 * Upload d'avatar / logo côté SERVEUR.
 *
 * Pourquoi pas en direct côté browser ? Le client Supabase browser propage
 * mal la session JWT vers Storage dans certains cas (cookies SSR), ce qui
 * faisait planter l'upload en 400 (RLS — auth.uid() vu comme NULL). Côté
 * serveur, on a une session vérifiée propre via @supabase/ssr → l'upload
 * passe systématiquement.
 *
 * Le paramètre `kind` choisit le préfixe de fichier ("avatar" ou "logo").
 * On garde le même bucket "avatars" pour les deux : c'est public en lecture
 * et la policy RLS ne distingue pas (juste foldername = auth.uid()).
 */
export async function uploadAvatar(
  formData: FormData,
  kind: "avatar" | "logo" = "avatar",
): Promise<{ ok: boolean; url?: string; error?: string }> {
  /* `validerImage` lit les OCTETS. L'ancien contrôle se contentait de
     `file.type.startsWith("image/")` et prenait l'extension dans le nom du
     fichier — deux renseignements fournis par le client. Un fichier texte
     déclaré « image/png » passait, et un SVG aussi : servi en `image/svg+xml`,
     il exécute son script quand on l'ouvre dans un onglet. Mesuré le
     22/10/2026. */
  const controle = await validerImage(formData.get("file"));
  if (!controle.ok) return { ok: false, error: controle.error };
  const { octets, ext: safeExt, type: typeServi } = controle.image;

  // Vérification d'identité avec le client SSR (lecture du cookie session).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // Path verrouillé sur l'user.id authentifié → impossible d'écrire dans le
  // dossier d'un autre user via cette action. L'extension vient du format
  // RÉEL : le nom du fichier n'entre pas dans le chemin.
  const path = `${user.id}/${kind}.${safeExt}`;

  // L'upload lui-même est fait avec le client admin (service-role) qui
  // bypass RLS. Pourquoi : le client SSR @supabase/ssr ne propage pas
  // toujours le JWT vers Storage (constaté en prod, 400 RLS systématique
  // même avec session OK). Comme l'identité a déjà été vérifiée et le path
  // verrouillé sur user.id juste au-dessus, c'est safe.
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from("avatars")
    .upload(path, octets, { upsert: true, cacheControl: "3600", contentType: typeServi });
  if (upErr) {
    console.error("uploadAvatar: storage upload failed", upErr);
    if (upErr)
      return {
        ok: false,
        error: await echecEcriture("photo/televersement", upErr, "Ta photo n'a pas pu être envoyée. Réessaie, ou choisis une image plus légère."),
      };
  }

  const { data } = admin.storage.from("avatars").getPublicUrl(path);
  // ?v=timestamp pour invalider le cache CDN si l'image change.
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
}

export type OnboardingData = {
  handle: string;
  bio: string;
  avatarUrl: string | null;
  customNiche: string;
  /** Ville du créateur, saisie librement. Normalisée côté serveur. */
  city: string;
  /** Accepte de se déplacer hors de sa ville pour un tournage. */
  travels: boolean;
  niches: number[];
  platforms: {
    platformId: number;
    handle: string;
    subscribers: number | null;
    url: string;
  }[];
  offers: { offer: OfferId; price: number | null }[];
};

/* ─── Pourquoi ces écritures ne sont plus des `upsert` ───
 *
 * Un `upsert` PostgREST écrit TOUTES les colonnes fournies, `id` compris, y
 * compris dans la branche « la ligne existe déjà ». Or la migration 0068 a
 * retiré au navigateur le droit de modifier les colonnes qu'il n'a aucune
 * raison de toucher — et `id` en fait partie. Postgres refuse alors la requête
 * ENTIÈRE, pas seulement la colonne fautive.
 *
 * Observé le 10 septembre : une marque changeait son logo, cliquait
 * Enregistrer, et rien ne partait. Le message d'erreur existait, mais il
 * s'affiche en haut du formulaire — hors de vue de quelqu'un qui vient de
 * cliquer en bas. Invisible, donc, jusqu'à ce que Julien remarque que son logo
 * ne tenait pas d'une visite à l'autre.
 *
 * La ligne est créée par le déclencheur `handle_new_user` à l'inscription : la
 * mettre à jour suffit. L'insertion reste en second recours pour les comptes
 * antérieurs à ce déclencheur — et elle, a bien le droit d'écrire `id`.
 */

/**
 * Le compte a-t-il bien le rôle qu'il prétend remplir ?
 *
 * ─── Ce que l'absence de ce contrôle permettait ───
 * Ni `saveCreatorOnboarding` ni `saveBrandOnboarding` ne regardaient le rôle.
 * N'importe quel compte connecté pouvait donc appeler l'autre — une action
 * serveur est une adresse HTTP publique, il n'y a pas besoin de voir l'écran
 * pour l'appeler. Mesuré le 22/10/2026 sur le projet de développement :
 *
 *   • une MARQUE appelant `saveCreatorOnboarding` obtenait une ligne dans
 *     `creators` et le pseudo de son choix. `/creators/<pseudo>` répondait 200
 *     à un visiteur anonyme, avec une page de profil créateur au nom de la
 *     marque, et le compte sortait dans la recherche de créateurs. Les pseudos
 *     sont uniques et publics : c'est l'identité des créateurs qu'on pouvait
 *     réserver, y compris un pseudo ressemblant à celui d'un vrai créateur ;
 *
 *   • un CRÉATEUR appelant `saveBrandOnboarding` obtenait une ligne dans
 *     `brands` et une page publique `/brands/<id>` à son nom d'emprunt.
 *
 * Aucun des deux ne donnait de pouvoir sur l'argent : `requireBrand` et les
 * autres portes lisent `profiles.role`, qui ne bougeait pas. Mais les deux
 * fabriquaient des pages publiques décrivant un compte pour ce qu'il n'est pas.
 *
 * Le rôle ne s'établit que par `confirmerRole`, qui passe par la fonction SQL
 * `confirm_user_role` : une transaction, et un refus si le rôle est déjà fixé.
 * C'est donc lui qu'on interroge ici, et rien d'autre.
 */
async function roleAttendu(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  attendu: "creator" | "brand",
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role === attendu) return null;
  return attendu === "creator"
    ? "Ce compte n'est pas un compte créateur."
    : "Ce compte n'est pas un compte marque.";
}

export async function saveCreatorOnboarding(
  data: OnboardingData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const mauvaisRole = await roleAttendu(supabase, user.id, "creator");
  if (mauvaisRole) return { ok: false, error: mauvaisRole };

  // Photo de profil (sur le profil). On log si ça échoue mais on ne bloque pas :
  // l'utilisateur peut avoir voulu juste mettre à jour ses infos sans photo.
  if (data.avatarUrl) {
    const { error: profErr } = await supabase
      .from("profiles")
      .update({ avatar_url: data.avatarUrl })
      .eq("id", user.id);
    if (profErr) {
      console.error("saveCreatorOnboarding: profile avatar update failed", profErr);
    }
  }

  // Profil créateur — UPSERT pour être robuste si la row n'a pas été créée
  // par le trigger handle_new_user (rare mais possible en cas de signup
  // historique avant que le trigger ne soit en place).
  const fiche = {
        handle: data.handle || null,
        bio: data.bio || null,
        custom_niche: data.customNiche || null,
        city: data.city?.trim() || null,
        // Le slug ne se saisit jamais : il se calcule, sinon le filtre par
        // ville ne regrouperait rien.
        city_slug: citySlug(data.city ?? ""),
        travels: Boolean(data.travels),
  };
  const { data: majCreateur, error: errMajCreateur } = await supabase
    .from("creators")
    .update(fiche)
    .eq("id", user.id)
    .select("id");
  const creatorErr =
    errMajCreateur ??
    (majCreateur && majCreateur.length > 0
      ? null
      : (await supabase.from("creators").insert({ id: user.id, ...fiche })).error);
  if (creatorErr) {
    console.error("saveCreatorOnboarding: creators upsert failed", creatorErr);
    return { ok: false, error: `Profil créateur : ${creatorErr.message}` };
  }

  // Niches (remplacement complet)
  const { error: nichesDelErr } = await supabase
    .from("creator_niches")
    .delete()
    .eq("creator_id", user.id);
  if (nichesDelErr) {
    console.error("saveCreatorOnboarding: niches delete failed", nichesDelErr);
    return { ok: false, error: `Niches : ${nichesDelErr.message}` };
  }
  /* `?? []` : la forme de `data` n'est pas plus garantie que son type — un
     corps de requête sans `niches` faisait planter l'action sur « Cannot read
     properties of undefined », APRÈS avoir déjà écrit la fiche. Le compte
     restait à moitié créé. */
  const niches = data.niches ?? [];
  if (niches.length > 0) {
    const { error: nichesInsErr } = await supabase
      .from("creator_niches")
      .insert(niches.map((niche_id) => ({ creator_id: user.id, niche_id })));
    if (nichesInsErr) {
      console.error("saveCreatorOnboarding: niches insert failed", nichesInsErr);
      return { ok: false, error: `Niches : ${nichesInsErr.message}` };
    }
  }

  // Réseaux (remplacement complet)
  const { error: platDelErr } = await supabase
    .from("creator_platforms")
    .delete()
    .eq("creator_id", user.id);
  if (platDelErr) {
    console.error("saveCreatorOnboarding: platforms delete failed", platDelErr);
    return { ok: false, error: `Réseaux : ${platDelErr.message}` };
  }
  const platforms = data.platforms ?? [];
  if (platforms.length > 0) {
    const { error: platInsErr } = await supabase.from("creator_platforms").insert(
      platforms.map((p) => ({
        creator_id: user.id,
        platform_id: p.platformId,
        handle: p.handle || null,
        subscribers: p.subscribers,
        url: p.url || null,
      })),
    );
    if (platInsErr) {
      console.error("saveCreatorOnboarding: platforms insert failed", platInsErr);
      return { ok: false, error: `Réseaux : ${platInsErr.message}` };
    }
  }

  // Offres & tarifs (remplacement complet)
  const { error: offDelErr } = await supabase
    .from("creator_offers")
    .delete()
    .eq("creator_id", user.id);
  if (offDelErr) {
    console.error("saveCreatorOnboarding: offers delete failed", offDelErr);
    return { ok: false, error: `Offres : ${offDelErr.message}` };
  }
  const offers = data.offers ?? [];
  if (offers.length > 0) {
    const { error: offInsErr } = await supabase
      .from("creator_offers")
      .insert(
        offers.map((o) => ({ creator_id: user.id, offer: o.offer, price: o.price })),
      );
    if (offInsErr) {
      console.error("saveCreatorOnboarding: offers insert failed", offInsErr);
      return { ok: false, error: `Offres : ${offInsErr.message}` };
    }
  }

  // Invalider toutes les pages qui dépendent du profil créateur.
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/onboarding/creator");
  revalidatePath("/creators");
  if (data.handle) revalidatePath(`/creators/${data.handle}`);
  return { ok: true };
}

export type BrandOnboardingData = {
  name: string;
  sector: string;
  website: string;
  logoUrl: string | null;
  description?: string;
  niches?: number[];
  platforms?: {
    platformId: number;
    handle: string;
    url: string;
  }[];
};

export async function saveBrandOnboarding(
  data: BrandOnboardingData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const mauvaisRole = await roleAttendu(supabase, user.id, "brand");
  if (mauvaisRole) return { ok: false, error: mauvaisRole };

  // UPSERT pour la même raison que côté créateur — robuste si la row n'existe pas.
  const fiche = {
        name: data.name,
        sector: data.sector || null,
        // Une adresse collée depuis la barre du navigateur arrive souvent
        // avec les paramètres d'une publicité. On garde le site, pas la visite.
        website: normaliserSiteMarque(data.website),
        logo_url: data.logoUrl,
        description: data.description?.trim() || null,
  };
  const { data: majMarque, error: errMajMarque } = await supabase
    .from("brands")
    .update(fiche)
    .eq("id", user.id)
    .select("id");
  const brandErr =
    errMajMarque ??
    (majMarque && majMarque.length > 0
      ? null
      : (await supabase.from("brands").insert({ id: user.id, ...fiche })).error);
  if (brandErr) {
    console.error("saveBrandOnboarding: brands upsert failed", brandErr);
    return { ok: false, error: `Profil marque : ${brandErr.message}` };
  }

  // Niches ciblées (remplacement complet)
  if (data.niches) {
    const { error: delErr } = await supabase
      .from("brand_niches")
      .delete()
      .eq("brand_id", user.id);
    if (delErr) {
      console.error("saveBrandOnboarding: niches delete failed", delErr);
      return { ok: false, error: `Niches ciblées : ${delErr.message}` };
    }
    if (data.niches.length > 0) {
      const { error: insErr } = await supabase
        .from("brand_niches")
        .insert(data.niches.map((niche_id) => ({ brand_id: user.id, niche_id })));
      if (insErr) {
        console.error("saveBrandOnboarding: niches insert failed", insErr);
        return { ok: false, error: `Niches ciblées : ${insErr.message}` };
      }
    }
  }

  // Réseaux propres de la marque (remplacement complet)
  if (data.platforms) {
    const { error: delErr } = await supabase
      .from("brand_platforms")
      .delete()
      .eq("brand_id", user.id);
    if (delErr) {
      console.error("saveBrandOnboarding: platforms delete failed", delErr);
      return { ok: false, error: `Réseaux : ${delErr.message}` };
    }
    if (data.platforms.length > 0) {
      const { error: insErr } = await supabase.from("brand_platforms").insert(
        data.platforms.map((p) => ({
          brand_id: user.id,
          platform_id: p.platformId,
          handle: p.handle || null,
          url: p.url || null,
        })),
      );
      if (insErr) {
        console.error("saveBrandOnboarding: platforms insert failed", insErr);
        return { ok: false, error: `Réseaux : ${insErr.message}` };
      }
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/onboarding/brand");
  revalidatePath(`/brands/${user.id}`);
  return { ok: true };
}
