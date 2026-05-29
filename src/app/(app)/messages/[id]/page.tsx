import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Composer from "./Composer";

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

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
function hourLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
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

  let lastDay = "";

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

      {/* Fil de messages */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto py-5">
        {messages.length === 0 ? (
          <div className="m-auto text-center">
            <p className="text-sm font-medium text-ink">Démarrez la conversation</p>
            <p className="mt-1 text-sm text-zinc-500">
              Présentez-vous et expliquez votre projet de collaboration.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user.id;
            const showDay = dayLabel(m.created_at) !== lastDay;
            lastDay = dayLabel(m.created_at);
            return (
              <div key={m.id}>
                {showDay && (
                  <p className="my-3 text-center text-xs font-medium text-zinc-400">
                    {lastDay}
                  </p>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                      mine
                        ? "rounded-br-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                        : "rounded-bl-sm bg-white text-ink ring-1 ring-zinc-100"
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.body}</p>
                    <p className={`mt-1 text-right text-[10px] ${mine ? "text-white/70" : "text-zinc-400"}`}>
                      {hourLabel(m.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="-mx-5 sm:-mx-8">
        <Composer conversationId={id} />
      </div>
    </div>
  );
}
