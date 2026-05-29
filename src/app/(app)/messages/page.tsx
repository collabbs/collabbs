import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Messages — Collabbs" };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const iAmBrand = profile?.role === "brand";

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, brand_id, creator_id, updated_at")
    .order("updated_at", { ascending: false });
  const convs = conversations ?? [];

  const otherIds = [
    ...new Set(convs.map((c) => (iAmBrand ? c.creator_id : c.brand_id))),
  ];
  const convIds = convs.map((c) => c.id);

  const [profRes, msgRes] = await Promise.all([
    otherIds.length
      ? supabase.from("profiles").select("id, display_name, avatar_url").in("id", otherIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] }),
    convIds.length
      ? supabase
          .from("messages")
          .select("conversation_id, body, sender_id, read_at, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { conversation_id: string; body: string; sender_id: string; read_at: string | null; created_at: string }[] }),
  ]);

  const profMap = new Map((profRes.data ?? []).map((p) => [p.id, p]));
  const lastMsg = new Map<string, { body: string; sender_id: string; created_at: string }>();
  const unread = new Map<string, number>();
  for (const m of msgRes.data ?? []) {
    if (!lastMsg.has(m.conversation_id)) {
      lastMsg.set(m.conversation_id, { body: m.body, sender_id: m.sender_id, created_at: m.created_at });
    }
    if (m.sender_id !== user.id && !m.read_at) {
      unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
    }
  }

  // On masque les conversations sans aucun message (créées mais jamais ouvertes).
  const visible = convs.filter((c) => lastMsg.has(c.id));

  return (
    <>
      <h1 className="font-display text-3xl font-black tracking-tight text-ink">Messages</h1>
      <p className="mt-2 text-zinc-600">
        Échange directement avec {iAmBrand ? "les créateurs" : "les marques"}.
      </p>

      {visible.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
          <p className="font-semibold text-ink">Aucune conversation</p>
          <p className="mt-1 text-sm text-zinc-500">
            {iAmBrand
              ? "Contacte un créateur depuis une candidature ou son profil pour démarrer une discussion."
              : "Contacte une marque depuis une opportunité pour démarrer une discussion."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
          {visible.map((c) => {
            const otherId = iAmBrand ? c.creator_id : c.brand_id;
            const p = profMap.get(otherId);
            const last = lastMsg.get(c.id)!;
            const n = unread.get(c.id) ?? 0;
            const mine = last.sender_id === user.id;
            return (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 border-b border-zinc-50 px-4 py-3.5 transition last:border-0 hover:bg-zinc-50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-200 to-pink-200 text-sm font-bold text-purple-700">
                  {p?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (p?.display_name ?? "?").slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-ink">
                      {p?.display_name ?? "Utilisateur"}
                    </p>
                    <span className="shrink-0 text-xs text-zinc-400">{timeAgo(last.created_at)}</span>
                  </div>
                  <p className={`truncate text-sm ${n > 0 ? "font-medium text-ink" : "text-zinc-500"}`}>
                    {mine && <span className="text-zinc-400">Vous : </span>}
                    {last.body}
                  </p>
                </div>
                {n > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">
                    {n}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
