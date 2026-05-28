type Testimonial = {
  quote: string;
  name: string;
  role: string;
  photo?: string;
  initials?: string;
  tint: string;
};

// Témoignages de démonstration — à remplacer par de vrais avis.
const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "J'ai activé mon premier lien d'affiliation en 30 secondes. 1 200€ de commissions dès le premier mois, sans toucher à un contrat.",
    name: "Inès Bouaziz",
    role: "Créatrice Sport · 56k",
    photo:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces&q=80",
    tint: "linear-gradient(135deg,#fdba74,#ec4899)",
  },
  {
    quote:
      "Campagne UGC lancée le matin, 14 candidatures avant midi. Le paiement bloqué en escrow a fini de nous convaincre.",
    name: "Camille Faure",
    role: "Growth · marque DTC beauté",
    initials: "CF",
    tint: "linear-gradient(135deg,#a78bfa,#ec4899)",
  },
  {
    quote:
      "Enfin une plateforme qui ne prend pas un centime sur mes revenus. Je garde 100%, la marque gère la commission.",
    name: "Maxime Roy",
    role: "Créateur Finance · 175k",
    photo:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=faces&q=80",
    tint: "linear-gradient(135deg,#86efac,#22d3ee)",
  },
];

export default function Testimonials() {
  return (
    <section className="border-t border-zinc-100 bg-zinc-50/60">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            Ils utilisent Collabbs
          </p>
          <h2 className="mt-2 font-display text-4xl font-black tracking-tight text-ink sm:text-5xl">
            Créateurs et marques, conquis
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-2xl border border-zinc-100 bg-white p-7 shadow-sm"
            >
              <div className="mb-4 text-amber-400">★★★★★</div>
              <blockquote className="flex-1 text-[15px] leading-relaxed text-zinc-700">
                « {t.quote} »
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                {t.photo ? (
                  <span
                    className="h-11 w-11 rounded-full bg-cover bg-center ring-2 ring-white"
                    style={{ backgroundImage: `url("${t.photo}"), ${t.tint}` }}
                  />
                ) : (
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundImage: t.tint }}
                  >
                    {t.initials}
                  </span>
                )}
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    {t.name}
                  </span>
                  <span className="block text-xs text-zinc-500">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
