import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { compterParTranches } from "@/lib/par-tranches";

export type SidebarData = {
  role: "creator" | "brand";
  name: string;
  avatarUrl: string | null;
  badges: Record<string, number>;
  attention: string[];
};

/**
 * Récupère tout ce qu'il faut pour rendre la sidebar pour un user donné :
 * rôle, nom, avatar, pastilles d'unread, badges d'attention.
 * Utilisé par le layout `(app)` ET par `AppOrLandingShell` (pages
 * mi-publiques / mi-privées).
 *
 * Wrappé dans React `cache()` : si la même requête (même userId) survient
 * plusieurs fois dans le même render serveur (ex. layout + child component),
 * une seule exécution réelle. Optimisation gratuite Next.js.
 */
export const fetchSidebarData = cache(
  async (userId: string): Promise<SidebarData> => {
    const supabase = await createClient();

    // Phase 1 : tout ce qu'on peut faire en parallèle, sans dépendances.
    const [
      profileRes,
      convsRes,
      unreadNotifsRes,
      campsRes,
      activeLinksRes,
      creatorPendingAppsRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("role, display_name, avatar_url")
        .eq("id", userId)
        .single(),
      supabase.from("conversations").select("id"),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .is("read_at", null),
      supabase.from("campaigns").select("id, type").eq("brand_id", userId),
      // Liens d'affiliation du créateur (pour le badge "Mon activité")
      supabase
        .from("affiliate_links")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", userId),
      // Ce que le créateur a en attente : ses candidatures ET les invitations
      // reçues. Les deux appellent le même badge parce qu'elles disent la même
      // chose de son point de vue — quelque chose bouge, va voir.
      supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", userId)
        .eq("status", "pending"),
    ]);

    const profile = profileRes.data;
    const role: "creator" | "brand" =
      profile?.role === "brand" ? "brand" : "creator";

    const convIds = (convsRes.data ?? []).map((c) => c.id);
    const camps = campsRes.data ?? [];
    const campIds = camps.map((c) => c.id);
    const hasAffiliation = camps.some(
      (c) => c.type === "affiliation" || c.type === "hybrid",
    );

    // Phase 2 : les requêtes qui dépendent des résultats phase 1.
    /* ⚠️ `compterParTranches` et NON un `.in(…)` direct sur les deux
       premieres requetes.
       Ce bandeau est rendu a CHAQUE page de l'espace connecte. Une liste
       d'UUID passee dans l'URL d'une requete PostgREST franchit une marche
       vers 350 entrees : au-dela, huit secondes au lieu de cent
       millisecondes (voir `par-tranches.ts`). Une marque-agence avec 400
       campagnes, ou un compte avec 400 conversations, ne verrait pas une
       page lente — il verrait TOUT le produit lent, y compris les ecrans qui
       n'ont rien a voir. */
    const [unreadMsgs, pendingApps, brandRowRes] = await Promise.all([
      compterParTranches(convIds, (t) =>
        supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", t)
          .neq("sender_id", userId)
          .is("read_at", null),
      ),
      // Côté marque, le badge annonce « des candidatures à traiter ». Sans le
      // filtre sur `initiated_by`, ses propres invitations en attente s'y
      // ajouteraient : elle verrait un compteur monter en invitant des gens,
      // et cliquerait pour trouver un écran où il n'y a rien à décider.
      role === "brand"
        ? compterParTranches(campIds, (t) =>
            supabase
              .from("applications")
              .select("*", { count: "exact", head: true })
              .in("campaign_id", t)
              .eq("initiated_by", "creator")
              .eq("status", "pending"),
          )
        : Promise.resolve(0),
      role === "brand" && hasAffiliation
        ? supabase
            .from("brands")
            .select("tracking_verified_at")
            .eq("id", userId)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    const badges: Record<string, number> = {};
    if (unreadMsgs) badges["/messages"] = unreadMsgs;
    if (unreadNotifsRes.count) badges["/notifications"] = unreadNotifsRes.count;
    if (pendingApps) badges["/campaigns"] = pendingApps;

    // Badge "Mon activité" côté créateur : nb liens actifs + candidatures pending
    if (role === "creator") {
      const activityCount =
        (activeLinksRes.count ?? 0) + (creatorPendingAppsRes.count ?? 0);
      if (activityCount > 0) badges["/activity"] = activityCount;
    }

    const attention: string[] = [];
    if (role === "brand" && hasAffiliation) {
      const trackingVerified =
        brandRowRes.data && "tracking_verified_at" in brandRowRes.data
          ? brandRowRes.data.tracking_verified_at
          : null;
      if (!trackingVerified) attention.push("/tracking");
    }

    return {
      role,
      name: profile?.display_name ?? "Mon compte",
      avatarUrl: profile?.avatar_url ?? null,
      badges,
      attention,
    };
  },
);
