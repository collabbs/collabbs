import Link from "next/link";

type Plan = {
  name: string;
  price: string;
  desc: string;
  features: string[];
  cta: string;
  ctaHref: string;
  featured: boolean;
};

/**
 * ⚠️ Cette page annonçait des limites que le produit n'applique pas — « 3 deals
 * vidéo actifs / mois », « 5 liens d'affiliation actifs ». Aucune n'existait
 * dans le code, et aucune ne DOIT exister : bloquer la troisième
 * collaboration, c'est bloquer le chiffre d'affaires de la marque, donc le
 * nôtre. Une limite doit protéger la place de marché, pas empêcher la
 * première réussite.
 *
 * Ce que l'abonnement change est plus simple, et vrai : le TAUX. C'est le
 * modèle de Collabstr (10 % → 5 %) et d'Insense (20 % → 7 %).
 *
 * S'y ajoute UNE limite, et elle est réellement appliquée (voir `lib/limites`)
 * : le nombre de campagnes ouvertes en même temps. Elle respecte la règle —
 * on limite la vitrine, jamais la caisse. Le plan gratuit peut encaisser
 * autant de collaborations qu'il veut sur sa campagne ; c'est la simultanéité
 * qui se paie. Chaque ligne ci-dessous doit rester vérifiable dans le code :
 * une promesse tarifaire que le produit n'applique pas est un mensonge, et
 * une limite appliquée mais tue en est un autre.
 */
const PLANS: Plan[] = [
  {
    name: "Free",
    price: "0",
    desc: "Tout le produit, sans engagement",
    features: [
      "2 campagnes actives en même temps",
      "Collaborations et liens d'affiliation illimités",
      "Contrat écrit conforme et paiement séquestré",
      "Code promo, CPA, concours",
      "Analytics et export comptable",
      "10 % sur les collaborations · 20 % sur l'affiliation",
    ],
    cta: "Commencer gratuitement",
    ctaHref: "/signup?role=brand",
    featured: false,
  },
  {
    name: "Growth",
    price: "99",
    desc: "Rentable dès 4 950 € de collabs / mois",
    features: [
      "Tout le plan gratuit",
      "5 campagnes actives en même temps",
      "Support prioritaire 12h",
      "Templates de brief",
      "8 % sur les collaborations · 18 % sur l'affiliation",
    ],
    cta: "Démarrer Growth",
    ctaHref: "/signup?role=brand",
    featured: true,
  },
  {
    name: "Scale",
    price: "299",
    desc: "Rentable dès 5 980 € de collabs / mois",
    features: [
      "Tout le plan Growth",
      "Campagnes actives illimitées",
      "Plusieurs utilisateurs",
      "Account manager dédié",
      "5 % sur les collaborations · 15 % sur l'affiliation",
    ],
    cta: "Contacter les ventes",
    ctaHref: "mailto:contact@collabbs.com",
    featured: false,
  },
];

export default function Pricing() {
  return (
    <section id="tarifs" className="border-t border-zinc-100 bg-zinc-50/60">
      <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            Tarifs
          </p>
          <h2 className="mt-2 font-display text-4xl font-black tracking-tight text-ink sm:text-5xl">
            Côté marque, payez à votre rythme
          </h2>
          <p className="mt-3 text-zinc-600">
            Les créateurs, c&apos;est{" "}
            <span className="font-semibold text-ink">100 % gratuit, à vie</span>{" "}
            — la commission s&apos;ajoute au prix, elle n&apos;est jamais retenue
            sur leur rémunération. Ci-dessous, les plans pour les marques.
          </p>
        </div>

        <div className="mt-12 grid items-start gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl p-8 ${
                plan.featured
                  ? "bg-ink text-white shadow-xl ring-2 ring-purple-500"
                  : "border border-zinc-100 bg-white shadow-sm"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-xs font-semibold text-white">
                  Le plus populaire
                </span>
              )}
              <h3 className="font-display text-xl font-extrabold">{plan.name}</h3>
              <p
                className={`mt-1 text-sm ${
                  plan.featured ? "text-zinc-300" : "text-zinc-500"
                }`}
              >
                {plan.desc}
              </p>
              <p className="mt-5">
                <span className="font-display text-4xl font-black">
                  {plan.price}€
                </span>
                <span
                  className={`text-sm ${
                    plan.featured ? "text-zinc-400" : "text-zinc-500"
                  }`}
                >
                  {" "}
                  / mois
                </span>
              </p>

              <Link
                href={plan.ctaHref}
                className={`mt-6 block rounded-full px-5 py-3 text-center text-sm font-semibold transition ${
                  plan.featured
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90"
                    : "bg-ink text-white hover:opacity-90"
                }`}
              >
                {plan.cta}
              </Link>

              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm">
                    <span
                      className={
                        plan.featured ? "text-purple-300" : "text-emerald-500"
                      }
                    >
                      ✓
                    </span>
                    <span
                      className={plan.featured ? "text-zinc-200" : "text-zinc-600"}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
