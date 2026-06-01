import "server-only";
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
 */
export async function fetchSidebarData(userId: string): Promise<SidebarData> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, avatar_url")
    .eq("id", userId)
    .single();

  const role = profile?.role === "brand" ? "brand" : "creator";

  const badges: Record<string, number> = {};

  // Messages non lus.
  const { data: convs } = await supabase.from("conversations").select("id");
  const convIds = (convs ?? []).map((c) => c.id);
  if (convIds.length) {
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .neq("sender_id", userId)
      .is("read_at", null);
    if (count) badges["/messages"] = count;
  }

  // Notifications non lues.
  const { count: unreadNotifs } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);
  if (unreadNotifs) badges["/notifications"] = unreadNotifs;

  const attention: string[] = [];
  if (role === "brand") {
    const { data: camps } = await supabase
      .from("campaigns")
      .select("id, type")
      .eq("brand_id", userId);
    const campIds = (camps ?? []).map((c) => c.id);

    if (campIds.length) {
      const { count } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .in("campaign_id", campIds)
        .eq("status", "pending");
      if (count) badges["/campaigns"] = count;
    }

    const hasAffiliation = (camps ?? []).some(
      (c) => c.type === "affiliation" || c.type === "hybrid",
    );
    if (hasAffiliation) {
      const { data: brandRow } = await supabase
        .from("brands")
        .select("tracking_verified_at")
        .eq("id", userId)
        .single();
      if (!brandRow?.tracking_verified_at) attention.push("/tracking");
    }
  }

  return {
    role,
    name: profile?.display_name ?? "Mon compte",
    avatarUrl: profile?.avatar_url ?? null,
    badges,
    attention,
  };
}
