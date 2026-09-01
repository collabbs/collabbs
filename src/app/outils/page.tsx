import Link from "next/link";
import { SITE } from "@/lib/legal-entity";
import { OUTILS } from "@/lib/outils";

export const metadata = {
  title: "Outils gratuits pour créateurs et marques — Collabbs",
  description:
    "Des calculateurs gratuits et sans inscription pour chiffrer une collaboration : droits d'usage, seuil légal, tarifs. Écrits à partir du droit français et des pratiques réelles du marché.",
  alternates: { canonical: `${SITE.url}/outils` },
};

/**
 * Le sommaire des outils.
 *
 * Il n'en contient qu'un aujourd'hui, et c'est assumé : mieux vaut un outil
 * qu'on utilise qu'une page qui en promet cinq. La liste vit dans
 * `lib/outils` pour que le plan du site et le `llms.txt` la lisent sans la
 * recopier.
 */
export default function PageOutils() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
      <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">Outils</p>
      <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-ink sm:text-5xl">
        Chiffrer avant de signer
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600">
        Gratuits, sans inscription, et calculés avec les mêmes formules que celles qui
        s&apos;appliquent dans une vraie collaboration sur Collabbs.
      </p>

      <div className="mt-12 space-y-4">
        {OUTILS.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="group block rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-lg"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {o.pour}
            </p>
            <h2 className="mt-2 font-display text-xl font-black text-ink group-hover:text-purple-700">
              {o.titre}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">{o.resume}</p>
            <span className="mt-3 inline-block text-sm font-semibold text-purple-700">
              Ouvrir l&apos;outil →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
