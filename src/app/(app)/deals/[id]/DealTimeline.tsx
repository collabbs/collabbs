/**
 * Timeline visuelle du parcours deal — 6 étapes, statut + dates + SLA + qui agit.
 *
 * Pattern Stripe / Linear : barre horizontale (desktop) ou liste verticale
 * (mobile) avec puces numérotées, lignes de connexion, dates sous chaque
 * étape, et un encart "À faire ensuite" qui surligne l'étape en cours pour
 * la partie concernée.
 */

type StepState = "done" | "current" | "pending";

type Step = {
  n: number;
  emoji: string;
  label: string;
  hint?: string;
  date?: string | null;
  state: StepState;
  whoActs?: "brand" | "creator" | "none";
  sla?: { dueAt: string; daysLeft: number; overdue: boolean } | null;
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysBetween = (a: Date, b: Date) =>
  Math.ceil((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));

export type DealForTimeline = {
  created_at: string;
  status: "negotiation" | "active" | "completed" | "cancelled";
  accepted_at: string | null;
  escrow_due_at: string | null;
  brand_validated_at: string | null;
  brand_validation_deadline_days: number;
  deadline: string | null;
  revision_rounds_max: number;
  revision_rounds_used: number;
};

export default function DealTimeline({
  deal,
  paid,
  paidAt,
  released,
  releasedAt,
  allDelivered,
  firstDeliveredAt,
  viewerRole,
}: {
  deal: DealForTimeline;
  paid: boolean;
  paidAt: string | null;
  released: boolean;
  releasedAt: string | null;
  allDelivered: boolean;
  firstDeliveredAt: string | null;
  viewerRole: "brand" | "creator";
}) {
  const now = new Date();

  // ===== Calcul des 6 étapes =====
  const stepNegoDone = true; // dès qu'il y a un deal, les termes sont posés
  const stepSignedDone = deal.status !== "negotiation" && Boolean(deal.accepted_at);
  const stepPaidDone = paid;
  const stepDeliveredDone = allDelivered;
  const stepValidatedDone =
    deal.status === "completed" || Boolean(deal.brand_validated_at);
  const stepReleasedDone = released;

  // SLA paiement marque (si signé et pas encore payé)
  let escrowSla: Step["sla"] = null;
  if (stepSignedDone && !stepPaidDone && deal.escrow_due_at) {
    const due = new Date(deal.escrow_due_at);
    const daysLeft = daysBetween(now, due);
    escrowSla = { dueAt: deal.escrow_due_at, daysLeft, overdue: daysLeft < 0 };
  }

  // SLA validation marque (si livré et pas encore validé)
  let validationSla: Step["sla"] = null;
  if (stepPaidDone && stepDeliveredDone && !stepValidatedDone && firstDeliveredAt) {
    const due = new Date(
      new Date(firstDeliveredAt).getTime() +
        deal.brand_validation_deadline_days * 24 * 60 * 60 * 1000,
    );
    const daysLeft = daysBetween(now, due);
    validationSla = {
      dueAt: due.toISOString(),
      daysLeft,
      overdue: daysLeft < 0,
    };
  }

  // SLA livraison créateur (deadline du deal)
  let deliverySla: Step["sla"] = null;
  if (stepPaidDone && !stepDeliveredDone && deal.deadline) {
    const due = new Date(deal.deadline);
    const daysLeft = daysBetween(now, due);
    deliverySla = { dueAt: deal.deadline, daysLeft, overdue: daysLeft < 0 };
  }

  function nextCurrent(): number {
    if (!stepSignedDone) return 2;
    if (!stepPaidDone) return 3;
    if (!stepDeliveredDone) return 4;
    if (!stepValidatedDone) return 5;
    if (!stepReleasedDone) return 6;
    return 7; // terminé
  }
  const currentN = nextCurrent();

  const steps: Step[] = [
    {
      n: 1,
      emoji: "📝",
      label: "Termes posés",
      hint: "Montant, format, deadline, droits",
      date: fmtDate(deal.created_at),
      state: stepNegoDone ? "done" : "pending",
      whoActs: "none",
    },
    {
      n: 2,
      emoji: "✍️",
      label: "Contrat signé",
      hint: "Validation des 2 parties",
      date: fmtDate(deal.accepted_at),
      state: stepSignedDone
        ? "done"
        : currentN === 2
          ? "current"
          : "pending",
      whoActs: "creator",
    },
    {
      n: 3,
      emoji: "💳",
      label: "Paiement séquestré",
      hint: "Marque règle, fonds bloqués",
      date: fmtDate(paidAt),
      state: stepPaidDone ? "done" : currentN === 3 ? "current" : "pending",
      whoActs: "brand",
      sla: currentN === 3 ? escrowSla : null,
    },
    {
      n: 4,
      emoji: "🎬",
      label: "Livraison",
      hint: "Créateur dépose le contenu",
      date: fmtDate(firstDeliveredAt),
      state: stepDeliveredDone
        ? "done"
        : currentN === 4
          ? "current"
          : "pending",
      whoActs: "creator",
      sla: currentN === 4 ? deliverySla : null,
    },
    {
      n: 5,
      emoji: "✅",
      label: "Validation",
      hint:
        deal.revision_rounds_used > 0
          ? `${deal.revision_rounds_used}/${deal.revision_rounds_max} retouches utilisées`
          : `${deal.revision_rounds_max} retouches incluses`,
      date: fmtDate(deal.brand_validated_at),
      state: stepValidatedDone
        ? "done"
        : currentN === 5
          ? "current"
          : "pending",
      whoActs: "brand",
      sla: currentN === 5 ? validationSla : null,
    },
    {
      n: 6,
      emoji: "💸",
      label: "Versement",
      hint: "Créateur reçoit la part nette",
      date: fmtDate(releasedAt),
      state: stepReleasedDone ? "done" : currentN === 6 ? "current" : "pending",
      whoActs: "none",
    },
  ];

  const currentStep = steps.find((s) => s.state === "current");

  // ===== Encart action-à-faire pour le viewer =====
  let actionForViewer: { emoji: string; label: string; help: string } | null = null;
  if (deal.status === "cancelled") {
    actionForViewer = {
      emoji: "❌",
      label: "Deal annulé",
      help: "Ce parcours est terminé.",
    };
  } else if (currentStep) {
    if (currentStep.whoActs === viewerRole) {
      actionForViewer = {
        emoji: "👋",
        label: `À toi de jouer — ${currentStep.label.toLowerCase()}`,
        help: currentStep.hint ?? "",
      };
    } else if (currentStep.whoActs === "none") {
      actionForViewer = {
        emoji: "⏳",
        label: "En traitement automatique",
        help: currentStep.hint ?? "",
      };
    } else {
      actionForViewer = {
        emoji: "⏳",
        label:
          currentStep.whoActs === "brand"
            ? "En attente de la marque"
            : "En attente du créateur",
        help: currentStep.hint ?? "",
      };
    }
  } else if (deal.status === "completed") {
    actionForViewer = {
      emoji: "🎉",
      label: "Deal clôturé",
      help: "Tout est fait, bravo !",
    };
  }

  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-black text-ink">Parcours</h2>
        <p className="text-xs text-zinc-500">
          Étape {Math.min(currentN, 6)}/6
        </p>
      </div>

      {/* Action box pour le viewer */}
      {actionForViewer && (
        <div
          className={`mt-4 flex items-start gap-3 rounded-xl border p-3 ${
            currentStep?.whoActs === viewerRole
              ? "border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50"
              : currentStep?.sla?.overdue
                ? "border-red-200 bg-red-50"
                : "border-zinc-200 bg-zinc-50"
          }`}
        >
          <span className="text-2xl">{actionForViewer.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{actionForViewer.label}</p>
            {actionForViewer.help && (
              <p className="text-xs text-zinc-600">{actionForViewer.help}</p>
            )}
            {currentStep?.sla && (
              <p
                className={`mt-1 text-xs font-medium ${
                  currentStep.sla.overdue
                    ? "text-red-700"
                    : currentStep.sla.daysLeft <= 1
                      ? "text-amber-700"
                      : "text-zinc-600"
                }`}
              >
                {currentStep.sla.overdue
                  ? `⚠️ Délai dépassé de ${Math.abs(currentStep.sla.daysLeft)} jour${Math.abs(currentStep.sla.daysLeft) > 1 ? "s" : ""}`
                  : currentStep.sla.daysLeft === 0
                    ? "⏰ À faire aujourd'hui"
                    : `⏰ Plus que ${currentStep.sla.daysLeft} jour${currentStep.sla.daysLeft > 1 ? "s" : ""}`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Timeline horizontale desktop, verticale mobile */}
      <div className="mt-5">
        {/* Desktop : bandeau horizontal */}
        <ol className="hidden items-stretch gap-1 sm:flex">
          {steps.map((s, i) => {
            const next = steps[i + 1];
            return (
              <li key={s.n} className="flex flex-1 items-center">
                <StepBubble step={s} />
                {next && <Connector from={s.state} to={next.state} />}
              </li>
            );
          })}
        </ol>
        {/* Liste detail (en dessous du bandeau / liste tout court en mobile) */}
        <ol className="mt-4 space-y-2 sm:mt-5 sm:grid sm:grid-cols-2 sm:gap-2 sm:space-y-0 lg:grid-cols-3">
          {steps.map((s) => (
            <li
              key={`detail-${s.n}`}
              className={`flex items-start gap-3 rounded-xl p-3 ${
                s.state === "current"
                  ? "border border-purple-200 bg-purple-50/40"
                  : s.state === "done"
                    ? "border border-zinc-100 bg-white"
                    : "border border-zinc-100 bg-zinc-50/30"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                  s.state === "done"
                    ? "bg-emerald-100 text-emerald-700"
                    : s.state === "current"
                      ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {s.state === "done" ? "✓" : s.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-bold ${
                    s.state === "pending" ? "text-zinc-400" : "text-ink"
                  }`}
                >
                  {s.label}
                </p>
                {s.hint && (
                  <p className="text-[11px] text-zinc-500">{s.hint}</p>
                )}
                {s.date && (
                  <p className="mt-1 text-[11px] font-medium text-zinc-600">
                    {s.date}
                  </p>
                )}
                {s.state === "current" && s.sla && (
                  <p
                    className={`mt-1 text-[11px] font-bold ${
                      s.sla.overdue
                        ? "text-red-700"
                        : s.sla.daysLeft <= 1
                          ? "text-amber-700"
                          : "text-zinc-500"
                    }`}
                  >
                    {s.sla.overdue
                      ? `Dépassé · J+${Math.abs(s.sla.daysLeft)}`
                      : `J-${s.sla.daysLeft}`}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepBubble({ step }: { step: Step }) {
  const isDone = step.state === "done";
  const isCurrent = step.state === "current";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full text-base shadow-sm ${
          isDone
            ? "bg-emerald-100 text-emerald-700"
            : isCurrent
              ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white"
              : "bg-zinc-100 text-zinc-400"
        }`}
        title={step.label}
      >
        {isDone ? "✓" : step.n}
      </span>
      <span
        className={`text-[10px] font-bold uppercase tracking-wide ${
          isCurrent
            ? "text-brand-deep"
            : isDone
              ? "text-emerald-700"
              : "text-zinc-400"
        }`}
      >
        {step.emoji}
      </span>
    </div>
  );
}

function Connector({ from, to }: { from: StepState; to: StepState }) {
  // Ligne d'horizontale entre 2 bulles. Verte si la précédente est done.
  const color = from === "done" ? "bg-emerald-300" : "bg-zinc-200";
  return <span className={`mx-1 h-0.5 flex-1 rounded ${color}`} />;
}
