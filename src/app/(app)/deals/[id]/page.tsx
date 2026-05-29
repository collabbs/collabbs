import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  DEAL_FORMAT_LABEL,
  DEAL_STATUS_META,
  dealBreakdown,
  eur,
  type DealFormat,
  type DealStatus,
} from "@/lib/deal";
import { openConversation } from "../../messages/actions";
import DealControls from "./DealControls";
import ReviewBox from "./ReviewBox";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("title").eq("id", id).single();
  return { title: data?.title ? `${data.title} — Collabbs` : "Collaboration — Collabbs" };
}

export default async function DealDetailPage({
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

  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, brand_id, creator_id, title, amount, format, platform_id, quantity, deadline, brand_notes, status, created_at",
    )
    .eq("id", id)
    .single();
  if (!deal) notFound();
  if (deal.brand_id !== user.id && deal.creator_id !== user.id) notFound();

  const role: "brand" | "creator" = deal.brand_id === user.id ? "brand" : "creator";
  const otherId = role === "brand" ? deal.creator_id : deal.brand_id;

  const [otherRes, delsRes, platRes, reviewRes] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url, role").eq("id", otherId).single(),
    supabase
      .from("deliverables")
      .select("id, label, done, approved, position")
      .eq("deal_id", id)
      .order("position"),
    deal.platform_id
      ? supabase.from("platforms").select("label").eq("id", deal.platform_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("reviews").select("rating, comment").eq("deal_id", id).maybeSingle(),
  ]);
  const other = otherRes.data;
  const deliverables = delsRes.data ?? [];
  const existingReview = reviewRes.data ?? null;
  const status = deal.status as DealStatus;
  const meta = DEAL_STATUS_META[status];
  const b = dealBreakdown(deal.amount);

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";

  return (
    <>
      <Link href="/deals" className="text-sm font-medium text-zinc-500 transition hover:text-ink">
        ← Toutes les collaborations
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-200 to-pink-200 text-sm font-bold text-purple-700">
            {other?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={other.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (other?.display_name ?? "?").slice(0, 1).toUpperCase()
            )}
          </span>
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight text-ink">
              {deal.title ?? "Collaboration"}
            </h1>
            <p className="text-sm text-zinc-500">
              {role === "brand" ? "avec " : "pour "}
              <span className="font-medium text-ink">{other?.display_name ?? "—"}</span>
            </p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${meta.className}`}>
          {meta.label}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Colonne principale */}
        <div className="space-y-5">
          {/* Termes */}
          <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-black text-ink">Termes de la collaboration</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-zinc-500">Format</dt>
                <dd className="font-semibold text-ink">
                  {DEAL_FORMAT_LABEL[deal.format as DealFormat]}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Quantité</dt>
                <dd className="font-semibold text-ink">{deal.quantity}</dd>
              </div>
              {platRes.data?.label && (
                <div>
                  <dt className="text-xs text-zinc-500">Réseau</dt>
                  <dd className="font-semibold text-ink">{platRes.data.label}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-zinc-500">Échéance</dt>
                <dd className="font-semibold text-ink">{fmtDate(deal.deadline)}</dd>
              </div>
            </dl>
            {deal.brand_notes && (
              <div className="mt-4 border-t border-zinc-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Brief</p>
                <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">{deal.brand_notes}</p>
              </div>
            )}
          </div>

          {/* Contrôles (client) : livrables + actions */}
          <DealControls
            dealId={deal.id}
            role={role}
            status={status}
            deliverables={deliverables}
            terms={{
              amount: deal.amount,
              quantity: deal.quantity,
              deadline: deal.deadline,
              brandNotes: deal.brand_notes,
            }}
          />

          <ReviewBox
            dealId={deal.id}
            role={role}
            status={status}
            existingReview={existingReview}
          />
        </div>

        {/* Colonne paiement (sticky) */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-black text-ink">Paiement</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Montant</dt>
                <dd className="font-semibold text-ink">{eur(b.gross)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Commission Collabbs (10%)</dt>
                <dd className="text-zinc-500">− {eur(b.fee)}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-100 pt-2">
                <dt className="font-semibold text-ink">
                  {role === "brand" ? "À régler" : "Tu reçois"}
                </dt>
                <dd className="font-display text-lg font-black text-ink">
                  {role === "brand" ? eur(b.gross) : eur(b.net)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">
              {status === "completed"
                ? "✅ Collaboration terminée. Le versement sécurisé arrive avec l'intégration des paiements (Stripe)."
                : "🔒 Le paiement sera mis sous séquestre à l'acceptation et versé à la clôture (Stripe — bientôt)."}
            </div>

            <form action={openConversation.bind(null, otherId)} className="mt-4">
              <button
                type="submit"
                className="w-full rounded-full px-5 py-2.5 text-sm font-semibold text-brand ring-1 ring-inset ring-purple-200 transition hover:bg-purple-50"
              >
                💬 Discuter avec {(other?.display_name ?? "").split(" ")[0] || "l'autre partie"}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
}
