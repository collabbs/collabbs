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

  /* ─── La conversation mène quelque part ───────────────────────────────────
     L'en-tête ne portait que le nom et le rôle. Or c'est ICI que le deal se
     conclut — « ok, 200 € pour deux stories » — et à cet instant la marque
     devait quitter le chat, retrouver le créateur dans la recherche, et tout
     ressaisir. C'est le moment précis où l'on perd des collaborations.

     On cherche donc la collaboration ouverte entre ces deux-là. S'il y en a
     une, les deux parties y accèdent d'un clic — le créateur aussi, qui
     jusqu'ici n'avait aucun chemin depuis le chat. Sinon, et seulement côté
     marque, on propose de l'ouvrir : un créateur ne se propose pas à
     lui-même. */
  const { data: collab } = await supabase
    .from("deals")
    .select("id, status")
    .eq("brand_id", conv.brand_id)
    .eq("creator_id", conv.creator_id)
    .in("status", ["negotiation", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const jeSuisLaMarque = conv.brand_id === user.id;

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
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">
            {other?.display_name ?? "Utilisateur"}
          </p>
          <p className="text-xs text-zinc-400">
            {other?.role === "brand" ? "Marque" : "Créateur"}
          </p>
        </div>

        {collab ? (
          <Link
            href={`/deals/${collab.id}`}
            className="ml-auto shrink-0 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-ink"
          >
            {collab.status === "negotiation"
              ? "Voir la proposition"
              : "Voir la collaboration"}
          </Link>
        ) : jeSuisLaMarque ? (
          <Link
            href={`/deals/nouveau?createur=${conv.creator_id}`}
            className="ml-auto shrink-0 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Proposer une collaboration
          </Link>
        ) : null}
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
