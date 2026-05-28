import type { IconType } from "react-icons";
import {
  LuLink2,
  LuTrendingUp,
  LuLayoutGrid,
  LuShieldCheck,
  LuFileCheck,
  LuBadgePercent,
} from "react-icons/lu";

type Advantage = {
  Icon: IconType;
  title: string;
  desc: string;
  highlight?: boolean;
};

const ADVANTAGES: Advantage[] = [
  {
    Icon: LuLink2,
    title: "Affiliation en 1 clic",
    desc: "Le créateur génère un lien tracké en un clic et touche une commission sur chaque vente. Sans risque pour la marque.",
    highlight: true,
  },
  {
    Icon: LuTrendingUp,
    title: "Commissions par palier",
    desc: "Nano 3% · Micro 5% · Mid 8% · Macro 12%. Chaque marque configure sa grille selon la taille du créateur.",
  },
  {
    Icon: LuLayoutGrid,
    title: "5 formats de collaboration",
    desc: "UGC, vidéo postée, story, paiement à la performance et affiliation — tout au même endroit.",
  },
  {
    Icon: LuShieldCheck,
    title: "Paiement sécurisé (escrow)",
    desc: "L'argent est bloqué à la commande et libéré seulement à la livraison. 0 impayé, des deux côtés.",
  },
  {
    Icon: LuFileCheck,
    title: "Contrats automatiques",
    desc: "Générés et signés en 5 secondes, juridiquement valides et conformes (eIDAS, règles ARPP).",
  },
  {
    Icon: LuBadgePercent,
    title: "0% pour les créateurs",
    desc: "Les créateurs gardent 100% de leurs revenus. La commission ne pèse que côté marque.",
  },
];

export default function Advantages() {
  return (
    <section className="border-t border-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            Pourquoi Collabbs
          </p>
          <h2 className="mt-2 font-display text-4xl font-black tracking-tight text-ink sm:text-5xl">
            Plus qu&apos;une marketplace
          </h2>
          <p className="mt-3 text-zinc-600">
            La simplicité de l&apos;UGC, la puissance de l&apos;affiliation à la
            performance — avec la confiance en plus.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ADVANTAGES.map(({ Icon, title, desc, highlight }) => (
            <div
              key={title}
              className={`group relative overflow-hidden rounded-2xl p-7 transition duration-300 hover:-translate-y-1.5 ${
                highlight
                  ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-200"
                  : "border border-zinc-100 bg-white shadow-sm hover:border-purple-100 hover:shadow-xl"
              }`}
            >
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl transition ${
                  highlight ? "bg-white/20" : "bg-purple-100/0 group-hover:bg-purple-100/60"
                }`}
              />
              <div
                className={`relative flex h-12 w-12 items-center justify-center rounded-xl ${
                  highlight
                    ? "bg-white/15 text-white ring-1 ring-white/30"
                    : "bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-md shadow-purple-200"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3
                className={`relative mt-5 text-lg font-bold ${
                  highlight ? "text-white" : "text-ink"
                }`}
              >
                {title}
              </h3>
              <p
                className={`relative mt-2 text-sm leading-relaxed ${
                  highlight ? "text-white/85" : "text-zinc-600"
                }`}
              >
                {desc}
              </p>
              {highlight && (
                <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25">
                  ✦ Notre signature
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
