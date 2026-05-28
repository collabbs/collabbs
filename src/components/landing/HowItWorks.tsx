import Link from "next/link";

type Step = { title: string; desc: string };

const BRAND_STEPS: Step[] = [
  {
    title: "Trouvez le bon créateur",
    desc: "Parcourez par niche, réseau, audience et engagement — ou publiez un brief et laissez les créateurs candidater.",
  },
  {
    title: "Choisissez votre format",
    desc: "UGC, vidéo postée, story, paiement à la performance ou affiliation en 1 clic. À vous de voir.",
  },
  {
    title: "Collaborez en confiance",
    desc: "Contrat généré automatiquement, paiement bloqué en escrow et libéré seulement à la livraison.",
  },
];

const CREATOR_STEPS: Step[] = [
  {
    title: "Créez votre profil",
    desc: "Niche, réseaux, offres et tarifs. Gratuit, en 5 minutes.",
  },
  {
    title: "Recevez des opportunités",
    desc: "Des deals de marques qui correspondent à votre profil — ou activez un lien d'affiliation en 1 clic.",
  },
  {
    title: "Soyez payé",
    desc: "0% de commission, paiement garanti et bloqué en escrow avant chaque publication.",
  },
];

function StepList({
  steps,
  accent,
}: {
  steps: Step[];
  accent: "brand" | "neutral";
}) {
  return (
    <ol className="mt-6 space-y-5">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-4">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
              accent === "brand"
                ? "bg-gradient-to-r from-purple-600 to-pink-600"
                : "bg-ink"
            }`}
          >
            {i + 1}
          </span>
          <div>
            <p className="font-semibold text-ink">{step.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-zinc-600">
              {step.desc}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function HowItWorks() {
  return (
    <section id="how" className="border-t border-zinc-100 bg-zinc-50/60">
      <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            Comment ça marche
          </p>
          <h2 className="mt-2 font-display text-4xl font-black tracking-tight text-ink sm:text-5xl">
            Simple des deux côtés
          </h2>
          <p className="mt-3 text-zinc-600">
            Marques et créateurs : trois étapes, zéro friction, paiement
            sécurisé.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm">
            <span className="inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-brand-deep">
              Pour les marques
            </span>
            <StepList steps={BRAND_STEPS} accent="brand" />
            <div className="mt-auto flex justify-center pt-10">
              <Link
                href="/creators"
                className="inline-flex rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Trouver un créateur
              </Link>
            </div>
          </div>

          <div className="flex flex-col rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm">
            <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-ink">
              Pour les créateurs
            </span>
            <StepList steps={CREATOR_STEPS} accent="neutral" />
            <div className="mt-auto flex justify-center pt-10">
              <Link
                href="/signup"
                className="inline-flex rounded-full border border-zinc-300 px-6 py-3 text-sm font-semibold text-ink transition hover:bg-zinc-100"
              >
                Créer mon profil — gratuit
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
