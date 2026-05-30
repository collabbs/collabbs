import Link from "next/link";

export default function TrackingStatusCard({
  verified,
  hasWebsite,
}: {
  verified: boolean;
  hasWebsite: boolean;
}) {
  if (verified) {
    return (
      <section className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            ✅ Tracking opérationnel
          </p>
          <p className="mt-0.5 text-xs text-emerald-700">
            Les ventes attribuées aux créateurs remontent automatiquement.
          </p>
        </div>
        <Link
          href="/tracking"
          className="rounded-full px-4 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-300 transition hover:bg-emerald-100"
        >
          Voir / modifier
        </Link>
      </section>
    );
  }
  return (
    <section className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div>
        <p className="text-sm font-semibold text-amber-800">
          🟡 Tracking pas encore configuré
        </p>
        <p className="mt-0.5 text-xs text-amber-700">
          {hasWebsite
            ? "Branche le tracking sur ton site, sinon les ventes ne remonteront pas."
            : "Renseigne d'abord le site de ta marque, puis branche le tracking."}
        </p>
      </div>
      <Link
        href="/tracking"
        className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
      >
        Configurer le tracking
      </Link>
    </section>
  );
}
