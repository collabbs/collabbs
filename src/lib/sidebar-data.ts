import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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
    // - profil (rôle, nom, avatar)
    // - conversations de l'user (pour les messages non lus en phase 2)
    // - notifications non lues (count direct)
    // - campagnes de la marque (cascade vers applications en phase 2)
    //   → on laisse partir même si l'user est créateur, c'est un count
    //     trivial qui renverra 0 ; évite un round-trip pour check le rôle.
    const [profileRes, convsRes, unreadNotifsRes, campsRes] = await Promise.all([
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
    const [unreadMsgsRes, pendingAppsRes, brandRowRes] = await Promise.all([
      convIds.length > 0
        ? supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .in("conversation_id", convIds)
            .neq("sender_id", userId)
            .is("read_at", null)
        : Promise.resolve({ count: 0 }),
      role === "brand" && campIds.length > 0
        ? supabase
            .from("applications")
            .select("*", { count: "exact", head: true })
            .in("campaign_id", campIds)
            .eq("status", "pending")
        : Promise.resolve({ count: 0 }),
      role === "brand" && hasAffiliation
        ? supabase
            .from("brands")
            .select("tracking_verified_at")
            .eq("id", userId)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    const badges: Record<string, number> = {};
    if (unreadMsgsRes.count) badges["/messages"] = unreadMsgsRes.count;
    if (unreadNotifsRes.count) badges["/notifications"] = unreadNotifsRes.count;
    if (pendingAppsRes.count) badges["/campaigns"] = pendingAppsRes.count;

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
