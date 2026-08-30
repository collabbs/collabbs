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
import { isLegalInfoComplete } from "@/app/(app)/profile/legal-utils";
import type { ContractSnapshot, PartySnapshot } from "@/lib/contract-snapshot";
import { thresholdWith, LEGAL_THRESHOLD } from "@/lib/legal-threshold";
import { openConversation } from "../../messages/actions";
import { createDealCheckout } from "../actions";
import DealControls from "./DealControls";
import ReviewBox from "./ReviewBox";
import RefundButton from "./RefundButton";
import ReceiveButton from "./ReceiveButton";
import DealTimeline from "./DealTimeline";

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

/**
 * Bloc "Parties au contrat" — rend les coordonnées légales des 2 parties
 * gelées dans le snapshot. Côte à côte sur desktop, empilées sur mobile.
 */
function PartyBlock({ label, p }: { label: string; p: PartySnapshot }) {
  const addressLines = [
    p.address,
    [p.zip, p.city].filter(Boolean).join(" "),
    p.country,
  ].filter(Boolean);
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-2 font-semibold text-ink">{p.legal_name ?? p.display_name}</p>
      {p.legal_status_label && (
        <p className="text-xs text-zinc-500">{p.legal_status_label}</p>
      )}
      {p.rep_name && (
        <p className="mt-1 text-xs text-zinc-500">
          Représenté·e par {p.rep_name}
        </p>
      )}
      {addressLines.length > 0 && (
        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-zinc-600">
          {addressLines.join("\n")}
        </p>
      )}
      {p.siret && (
        <p className="mt-2 text-xs text-zinc-500">
          <span className="font-medium">SIRET</span> {p.siret}
        </p>
      )}
      {p.vat && (
        <p className="text-xs text-zinc-500">
          <span className="font-medium">TVA</span> {p.vat}
        </p>
      )}
      {p.contact_email && (
        <p className="mt-2 text-xs text-zinc-500">
          <span className="font-medium">Contact</span> {p.contact_email}
        </p>
      )}
    </div>
  );
}

function ContractParties({ snap }: { snap: ContractSnapshot }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <PartyBlock label="Marque" p={snap.brand} />
      <PartyBlock label="Créateur" p={snap.creator} />
    </div>
  );
}

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; payerror?: string; stripe?: string }>;
}) {
  const { id } = await params;
  const retour = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, brand_id, creator_id, title, amount, format, platform_id, quantity, deadline, brand_notes, status, created_at, accepted_at, escrow_due_at, brand_validated_at, brand_validation_deadline_days, revision_rounds_max, revision_rounds_used",
    )
    .eq("id", id)
    .single();
  if (!deal) notFound();
  if (deal.brand_id !== user.id && deal.creator_id !== user.id) notFound();

  const role: "brand" | "creator" = deal.brand_id === user.id ? "brand" : "creator";
  const otherId = role === "brand" ? deal.creator_id : deal.brand_id;

  const [otherRes, delsRes, platRes, reviewRes, creatorPayoutRes, contractRes, txRes, myLegalRes] =
    await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url, role").eq("id", otherId).single(),
    supabase
      .from("deliverables")
      .select(
        "id, label, done, approved, position, submission_url, submission_notes, submission_files, submitted_at, revision_requested, revision_message",
      )
      .eq("deal_id", id)
      .order("position"),
    deal.platform_id
      ? supabase.from("platforms").select("label").eq("id", deal.platform_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("reviews").select("rating, comment").eq("deal_id", id).maybeSingle(),
    // Sert uniquement à dire la vérité sur un versement en attente.
    supabase
      .from("creators")
      .select("stripe_account_id")
      .eq("id", deal.creator_id)
      .maybeSingle(),
    supabase
      .from("contracts")
      .select(
        "reference, status, brand_signed_at, creator_signed_at, terminated_at, terms_snapshot",
      )
      .eq("deal_id", id)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select(
        "id, status, gross_amount, net_amount, platform_fee, created_at, escrow_released_at, paid_at",
      )
      .eq("deal_id", id)
      .eq("type", "deal_payment")
      .maybeSingle(),
    supabase
      .from("legal_info")
      .select("status, legal_name, address, city, zip")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const other = otherRes.data;
  // Vrai si le créateur a un compte de paiement connecté. Sert à ne pas
  // l'accuser à tort quand un versement n'aboutit pas.
  const creatorHasPayoutAccount = Boolean(
    (creatorPayoutRes.data as { stripe_account_id?: string | null } | null)
      ?.stripe_account_id,
  );

  const deliverables = delsRes.data ?? [];
  const existingReview = reviewRes.data ?? null;
  // Avis laissé par le créateur SUR la marque. La table arrive avec la
  // migration 0039 ; tant qu'elle n'est pas appliquée on n'affiche rien plutôt
  // que de casser la page.
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const { data: brandReviewRow } = await (supabase as any)
    .from("brand_reviews")
    .select("rating, comment")
    .eq("deal_id", id)
    .maybeSingle();
  const existingBrandReview = brandReviewRow ?? null;
  const contract = contractRes.data ?? null;
  const myLegalReady = isLegalInfoComplete(myLegalRes.data);
  // Cumul annuel avec cette contrepartie, en incluant ce deal — ce qui permet
  // de dire « cette collaboration fait franchir le seuil » avant de signer.
  const thresholdState = await thresholdWith(deal.brand_id, deal.creator_id, deal.amount);
  const payment = txRes.data ?? null;
  const status = deal.status as DealStatus;
  const meta = DEAL_STATUS_META[status];
  const b = dealBreakdown(deal.amount);

  // Calculs timeline
  const paymentPaid =
    payment !== null &&
    (payment.status === "in_escrow" ||
      payment.status === "released" ||
      payment.status === "paid");
  const paymentPaidAt = paymentPaid ? payment?.created_at ?? null : null;
  const paymentReleased =
    payment !== null &&
    (payment.status === "released" || payment.status === "paid");
  const paymentReleasedAt = paymentReleased
    ? payment?.escrow_released_at ?? payment?.paid_at ?? null
    : null;
  const submittedDates = deliverables
    .map((dv) => (dv.submitted_at ? new Date(dv.submitted_at).getTime() : 0))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const firstDeliveredAt =
    submittedDates.length > 0 ? new Date(submittedDates[0]).toISOString() : null;
  const allDelivered =
    deliverables.length > 0 && deliverables.every((dv) => dv.done);

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const fmtDateTime = (d: string | null) =>
    d
      ? new Date(d).toLocaleString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

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
              {role === "creator" ? (
                <Link
                  href={`/brands/${otherId}`}
                  className="font-medium text-ink transition hover:text-brand hover:underline"
                >
                  {other?.display_name ?? "—"}
                </Link>
              ) : (
                <span className="font-medium text-ink">{other?.display_name ?? "—"}</span>
              )}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${meta.className}`}>
          {meta.label}
        </span>
      </div>

      {/* Retour de Stripe. Ces paramètres étaient posés par les redirections
          (`?paid=1`, `?payerror=1`, `?stripe=missing`) et lus par personne :
          la marque revenait de sa banque sans un mot, y compris quand le
          paiement avait été encaissé sans être enregistré chez nous. */}
      {retour.payerror === "1" && (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          <strong>Ton paiement a été encaissé, mais nous n&apos;avons pas pu
          l&apos;enregistrer.</strong>{" "}
          Ne recommence pas : écris à support@collabbs.com en indiquant cette
          collaboration, on régularise à la main.
        </div>
      )}
      {retour.stripe === "missing" && (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          Le paiement est momentanément indisponible. Réessaie dans quelques
          minutes — et préviens-nous si ça persiste.
        </div>
      )}
      {/* On ne l'affiche QUE si le paiement existe vraiment : sinon un
          `?paid=1` collé dans la barre d'adresse annoncerait un séquestre
          imaginaire. */}
      {retour.paid === "1" && payment && (
        <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
          ✅ Paiement reçu et <strong>mis en séquestre</strong>. Les fonds seront
          versés au créateur à la clôture de la collaboration.
        </div>
      )}

      {/* Timeline du parcours — visible en haut, sur toute la largeur */}
      <div className="mt-6">
        <DealTimeline
          deal={{
            created_at: deal.created_at,
            status: deal.status,
            accepted_at: deal.accepted_at,
            escrow_due_at: deal.escrow_due_at,
            brand_validated_at: deal.brand_validated_at,
            brand_validation_deadline_days: deal.brand_validation_deadline_days,
            deadline: deal.deadline,
            revision_rounds_max: deal.revision_rounds_max,
            revision_rounds_used: deal.revision_rounds_used,
          }}
          paid={paymentPaid}
          paidAt={paymentPaidAt}
          released={paymentReleased}
          releasedAt={paymentReleasedAt}
          allDelivered={allDelivered}
          firstDeliveredAt={firstDeliveredAt}
          viewerRole={role}
        />
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

          {/* Contrat */}
          {contract && (
            <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-black text-ink">
                  Contrat{" "}
                  <span className="font-mono text-sm font-medium text-zinc-400">
                    {contract.reference}
                  </span>
                </h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    contract.status === "signed"
                      ? "bg-emerald-50 text-emerald-700"
                      : contract.status === "terminated"
                        ? "bg-zinc-100 text-zinc-500"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {contract.status === "signed"
                    ? "Signé"
                    : contract.status === "terminated"
                      ? "Résilié"
                      : "En attente de signature"}
                </span>
              </div>

              {contract.status === "signed" ? (
                <>
                  <Link
                    href={`/contracts/${id}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    📄 Lire le contrat complet
                  </Link>

                  {/* Coordonnées des 2 parties (depuis le snapshot gelé) */}
                  {contract.terms_snapshot &&
                    typeof contract.terms_snapshot === "object" &&
                    "brand" in contract.terms_snapshot &&
                    "creator" in contract.terms_snapshot && (
                      <ContractParties
                        snap={contract.terms_snapshot as unknown as ContractSnapshot}
                      />
                    )}

                  <div className="mt-4 space-y-1.5 border-t border-zinc-100 pt-4 text-sm text-zinc-600">
                    <p className="flex items-center gap-2">
                      <span className="text-emerald-600">✓</span>
                      Marque — signé le {fmtDateTime(contract.brand_signed_at)}
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-emerald-600">✓</span>
                      Créateur — signé le {fmtDateTime(contract.creator_signed_at)}
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      Les coordonnées et termes ci-dessus ont été figés au
                      moment de la signature et engagent les deux parties.
                    </p>
                  </div>
                </>
              ) : contract.status === "terminated" ? (
                <p className="mt-2 text-sm text-zinc-500">
                  Contrat résilié le {fmtDateTime(contract.terminated_at)}.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-zinc-500">
                    Le contrat sera <strong className="text-ink">figé et signé automatiquement</strong>{" "}
                    dès que le créateur accepte les termes proposés.
                  </p>

                  {/* Où en est le cumul annuel avec cette contrepartie, et ce
                      que cette collaboration va y changer. C'est le moment où
                      l'information est utile : avant de s'engager. */}
                  <div
                    className={`mt-4 rounded-xl border p-3 ${
                      thresholdState.required
                        ? "border-amber-200 bg-amber-50"
                        : "border-zinc-200 bg-zinc-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-ink">
                      Cumul {new Date().getFullYear()} avec {other?.display_name ?? "cette partie"} :{" "}
                      {eur(thresholdState.total)} sur {eur(LEGAL_THRESHOLD)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                      {thresholdState.crossesWithThisDeal
                        ? "Cette collaboration fait franchir le seuil légal. Un contrat écrit détaillé devient obligatoire, et les infos légales des deux parties sont exigées pour signer."
                        : thresholdState.required
                          ? "Le seuil légal est déjà franchi cette année : le contrat écrit détaillé est obligatoire."
                          : `En dessous de ${eur(LEGAL_THRESHOLD)} cumulés sur l'année, la loi n'impose pas de contrat détaillé — un contrat simplifié suffit. Il reste ${eur(thresholdState.remaining)} de marge.`}
                    </p>
                  </div>

                  {/* Nudge légal — seulement quand ces infos sont réellement
                      exigées, c'est-à-dire au-dessus du seuil. En dessous, on
                      n'embête pas un créateur qui n'a pas encore de statut. */}
                  {!myLegalReady && thresholdState.required && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-800">
                        ⚠️ Tes infos légales sont incomplètes — au-dessus du seuil, la
                        signature sera bloquée tant qu&apos;elles ne sont pas à jour.
                      </p>
                      <Link
                        href="/profile"
                        className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white"
                      >
                        Compléter
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Contrôles (client) : livrables + actions */}
          <DealControls
            dealId={deal.id}
            role={role}
            status={status}
            deliverables={await Promise.all(
              deliverables.map(async (dv) => {
                const rawFiles = Array.isArray(dv.submission_files)
                  ? (dv.submission_files as Array<{
                      path: string;
                      name: string;
                      size: number;
                      mime: string;
                    }>)
                  : [];
                const signed = await Promise.all(
                  rawFiles.map(async (f) => {
                    const { data } = await supabase.storage
                      .from("deliverables")
                      .createSignedUrl(f.path, 3600);
                    return { ...f, signedUrl: data?.signedUrl ?? null };
                  }),
                );
                return {
                  id: dv.id,
                  label: dv.label,
                  done: dv.done,
                  approved: dv.approved,
                  position: dv.position,
                  submissionUrl: dv.submission_url,
                  submissionNotes: dv.submission_notes,
                  submissionFiles: signed,
                  revisionRequested: dv.revision_requested,
                  revisionMessage: dv.revision_message,
                };
              }),
            )}
            terms={{
              amount: deal.amount,
              quantity: deal.quantity,
              deadline: deal.deadline,
              brandNotes: deal.brand_notes,
            }}
            revisions={{
              used: deal.revision_rounds_used,
              max: deal.revision_rounds_max,
            }}
          />

          <ReviewBox
            dealId={deal.id}
            role={role}
            status={status}
            existingReview={existingReview}
            existingBrandReview={existingBrandReview}
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
                  {/* « À régler » se contredisait avec l'encart « Réglé — en
                      séquestre » juste en dessous. Une fois le séquestre payé,
                      il n'y a plus rien à régler. */}
                  {role === "brand"
                    ? payment && payment.status !== "refunded"
                      ? "Réglé"
                      : "À régler"
                    : "Tu reçois"}
                </dt>
                <dd className="font-display text-lg font-black text-ink">
                  {role === "brand" ? eur(b.gross) : eur(b.net)}
                </dd>
              </div>
            </dl>

            {payment && (payment.status === "released" || payment.status === "paid") ? (
              <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
                ✅ Versé au créateur — <strong>{eur(payment.net_amount)}</strong>.
              </div>
            ) : payment && payment.status === "refunded" ? (
              <div className="mt-4 rounded-xl bg-zinc-100 p-3 text-xs text-zinc-500">
                ↩️ Paiement remboursé à la marque.
              </div>
            ) : payment && payment.status === "in_escrow" ? (
              <div className="mt-4 space-y-2">
                <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
                  🔒 Réglé — <strong>{eur(payment.gross_amount)}</strong> en séquestre.
                  {/* Le motif était écrit en dur : la page annonçait « il doit
                      connecter son compte » même quand le créateur en avait un
                      et que le blocage venait d'ailleurs. La marque relançait
                      le créateur pour rien. */}
                  {status !== "completed"
                    ? " Les fonds seront versés au créateur à la clôture."
                    : creatorHasPayoutAccount
                      ? role === "creator"
                        ? " Ton versement n'a pas encore abouti. Vérifie que ton compte de paiement est complet ; nous relançons automatiquement."
                        : " Versement au créateur en attente. Rien à faire de ton côté : les fonds lui reviennent."
                      : role === "creator"
                        ? " Connecte ton compte pour recevoir ta part."
                        : " Versement en attente : le créateur n'a pas encore connecté son compte de paiement."}
                </div>
                {status === "completed" && role === "creator" && (
                  <ReceiveButton dealId={deal.id} amountLabel={eur(payment.net_amount)} />
                )}
                {role === "brand" && <RefundButton dealId={deal.id} />}
              </div>
            ) : role === "brand" && status === "active" && deal.amount > 0 ? (
              <form action={createDealCheckout.bind(null, deal.id)} className="mt-4">
                <button
                  type="submit"
                  className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Régler {eur(deal.amount)} (séquestre)
                </button>
                <p className="mt-1.5 text-center text-[11px] text-zinc-400">
                  Paiement sécurisé Stripe · test (carte 4242 4242 4242 4242)
                </p>
              </form>
            ) : (
              <div
                className={
                  status === "negotiation" && deal.amount <= 0
                    ? "mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"
                    : "mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500"
                }
              >
                {/* Un deal naît à 0 € : booking direct, ou candidature sur une
                    campagne à la performance qui n'a pas de forfait. Tant que
                    la marque n'a rien fixé, le créateur ne peut pas accepter —
                    il signerait un contrat à 0 €. On le dit ici, à côté du
                    montant, plutôt que de laisser le bouton échouer. */}
                {status === "negotiation" && deal.amount <= 0
                  ? role === "brand"
                    ? "✏️ Montant à fixer. Cette collaboration est à 0 € : utilise « Modifier les termes » pour indiquer ce que tu proposes. Le créateur ne peut pas accepter avant."
                    : "✏️ La marque n'a pas encore fixé le montant. Tu seras prévenu·e dès qu'elle l'aura indiqué."
                  : status === "negotiation"
                    ? "🔒 Le paiement sera mis en séquestre une fois le deal accepté."
                    : status === "active"
                      ? "🔒 En attente du règlement de la marque (mise en séquestre)."
                      : "Aucun paiement enregistré pour ce deal."}
              </div>
            )}

            {payment && payment.status !== "refunded" && (
              // La facture n'était atteignable que depuis la page des
              // versements — c'est-à-dire seulement par le créateur. La marque,
              // qui paie et qui supporte la commission, n'avait accès à aucun
              // justificatif pour sa comptabilité.
              <Link
                href={`/invoices/${payment.id}`}
                className="mt-3 block rounded-full px-5 py-2.5 text-center text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:text-ink"
              >
                🧾 Récapitulatif de paiement
              </Link>
            )}

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
