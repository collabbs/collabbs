import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markAllAsRead, markAsReadAndGo } from "./actions";

export const metadata = { title: "Notifications — Collabbs" };

const ICONS: Record<string, string> = {
  welcome: "👋",
  application_accepted: "✅",
  application_rejected: "📭",
  deal_proposed: "🤝",
  deal_accepted: "🤝",
  deal_completed: "🎉",
  deal_cancelled: "❌",
  deal_refunded: "↩️",
  deal_deadline_reminder: "⏰",
  first_affiliate_click: "👁️",
  first_affiliate_sale: "🎉",
  payment_received_brand: "🧾",
  payment_received_creator: "💸",
  affiliate_joined: "🔗",
  deliverable_submitted: "📎",
  deliverable_approved: "✅",
  review_received: "⭐",
  message: "💬",
  profile_incomplete_reminder: "👤",
  weekly_digest_creator: "📊",
};

function iconFor(type: string): string {
  return ICONS[type] ?? "🔔";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function bucketFor(iso: string): "today" | "yesterday" | "week" | "older" {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday.getTime() - 24 * 3600 * 1000);
  const startWeek = new Date(startToday.getTime() - 7 * 24 * 3600 * 1000);
  if (d >= startToday) return "today";
  if (d >= startYesterday) return "yesterday";
  if (d >= startWeek) return "week";
  return "older";
}

const BUCKET_LABEL: Record<string, string> = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  week: "Cette semaine",
  older: "Plus ancien",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: notifs } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const list = notifs ?? [];
  const unreadCount = list.filter((n) => !n.read_at).length;

  // Groupage par bucket temporel.
  const grouped = new Map<string, typeof list>();
  for (const n of list) {
    const b = bucketFor(n.created_at);
    const arr = grouped.get(b) ?? [];
    arr.push(n);
    grouped.set(b, arr);
  }
  const orderedBuckets: ("today" | "yesterday" | "week" | "older")[] = [
    "today",
    "yesterday",
    "week",
    "older",
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight text-ink">
            Notifications
          </h1>
          <p className="mt-1 text-zinc-600">
            {unreadCount > 0
              ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}.`
              : "Tu es à jour."}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllAsRead}>
            <button
              type="submit"
              className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
            >
              Tout marquer lu
            </button>
          </form>
        )}
      </div>

      {list.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
          <p className="text-2xl">🔔</p>
          <p className="mt-2 font-semibold text-ink">Pas encore de notifications</p>
          <p className="mt-1 text-sm text-zinc-500">
            Tu recevras une notification ici à chaque évènement important (paiement,
            candidature, deal, avis…).
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {orderedBuckets.map((bucket) => {
            const items = grouped.get(bucket);
            if (!items || items.length === 0) return null;
            return (
              <section key={bucket}>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {BUCKET_LABEL[bucket]}
                </p>
                <ul className="mt-2 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  {items.map((n) => {
                    const unread = !n.read_at;
                    return (
                      <li key={n.id} className="border-b border-zinc-50 last:border-0">
                        <form
                          action={markAsReadAndGo.bind(null, n.id, n.link ?? "/notifications")}
                        >
                          <button
                            type="submit"
                            className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-zinc-50 ${
                              unread ? "bg-purple-50/40" : ""
                            }`}
                          >
                            <span className="mt-0.5 text-xl">{iconFor(n.type)}</span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span
                                  className={`truncate text-sm ${
                                    unread ? "font-semibold text-ink" : "text-zinc-700"
                                  }`}
                                >
                                  {n.title}
                                </span>
                                {unread && (
                                  <span
                                    aria-hidden
                                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                                  />
                                )}
                              </span>
                              {n.body && (
                                <span className="mt-0.5 block truncate text-sm text-zinc-500">
                                  {n.body}
                                </span>
                              )}
                              <span className="mt-1 block text-[11px] text-zinc-400">
                                {timeAgo(n.created_at)}
                              </span>
                            </span>
                            {n.link && (
                              <span className="self-center text-zinc-400" aria-hidden>
                                →
                              </span>
                            )}
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
