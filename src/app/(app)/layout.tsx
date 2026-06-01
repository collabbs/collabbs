import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/app/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, avatar_url")
    .eq("id", user.id)
    .single();

  const role = profile?.role === "brand" ? "brand" : "creator";

  // Pastilles d'attention : messages non lus (RLS limite déjà aux miennes) + candidatures en attente (marque).
  const badges: Record<string, number> = {};

  const { data: convs } = await supabase.from("conversations").select("id");
  const convIds = (convs ?? []).map((c) => c.id);
  if (convIds.length) {
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
      .is("read_at", null);
    if (count) badges["/messages"] = count;
  }

  // Notifications non lues (RLS limite déjà aux miennes).
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
      .eq("brand_id", user.id);
    const campIds = (camps ?? []).map((c) => c.id);
    if (campIds.length) {
      const { count } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .in("campaign_id", campIds)
        .eq("status", "pending");
      if (count) badges["/campaigns"] = count;
    }

    // Tracking : pastille « à configurer » si une campagne affiliation existe
    // et que la marque n'a pas encore validé son installation.
    const hasAffiliation = (camps ?? []).some(
      (c) => c.type === "affiliation" || c.type === "hybrid",
    );
    if (hasAffiliation) {
      const { data: brandRow } = await supabase
        .from("brands")
        .select("tracking_verified_at")
        .eq("id", user.id)
        .single();
      if (!brandRow?.tracking_verified_at) attention.push("/tracking");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <Sidebar
        role={role}
        name={profile?.display_name ?? "Mon compte"}
        avatarUrl={profile?.avatar_url ?? null}
        badges={badges}
        attention={attention}
      />
      <div className="lg:pl-60">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">{children}</div>
      </div>
    </div>
  );
}
