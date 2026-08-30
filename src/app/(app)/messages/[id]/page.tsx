import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Thread from "./Thread";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { title: "Messages — Collabbs" };
  const { data: conv } = await supabase
    .from("conversations")
    .select("brand_id, creator_id")
    .eq("id", id)
    .single();
  if (!conv) return { title: "Messages — Collabbs" };
  const otherId = conv.brand_id === user.id ? conv.creator_id : conv.brand_id;
  const { data: p } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", otherId)
    .single();
  return { title: `${p?.display_name ?? "Conversation"} — Messages` };
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, brand_id, creator_id")
    .eq("id", id)
    .single();
  if (!conv) notFound();

  const otherId = conv.brand_id === user.id ? conv.creator_id : conv.brand_id;
  const { data: other } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, role")
    .eq("id", otherId)
    .single();

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  const messages = msgs ?? [];

  // Marque comme lus les messages entrants non lus.
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .neq("sender_id", user.id)
    .is("read_at", null);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* En-tête */}
      <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
        <Link href="/messages" className="text-zinc-400 transition hover:text-ink">
          ←
        </Link>
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-200 to-pink-200 text-sm font-bold text-purple-700">
          {other?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={other.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (other?.display_name ?? "?").slice(0, 1).toUpperCase()
          )}
        </span>
        <div>
          <p className="font-semibold text-ink">{other?.display_name ?? "Utilisateur"}</p>
          <p className="text-xs text-zinc-400">
            {other?.role === "brand" ? "Marque" : "Créateur"}
          </p>
        </div>
      </div>

      {/* Fil de messages : rendu ici, puis tenu à jour en direct côté client. */}
      <Thread
        conversationId={id}
        currentUserId={user.id}
        initialMessages={messages}
      />
    </div>
  );
}
