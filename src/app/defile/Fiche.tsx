"use client";

import PlatformIcon from "@/components/PlatformIcon";
import { OFFER_BY_ID } from "@/components/landing/creators";
import type { BriefDefile } from "@/lib/defile";
import { LIBELLES_TYPE } from "@/lib/collaboration";
import type { MarketplaceCreator } from "@/lib/creators-data";
import { photoDuBrief, remunerationLisible } from "./CarteBrief";
import { assombrir, eclaircir } from "@/lib/teinte";

/**
 * La fiche détaillée, ouverte en tapant sur une carte.
 *
 * ─── Le manque qu'elle comble ───
 * On ne peut pas demander de trancher sur ce qu'on n'a pas pu lire. La carte
 * montre ce qui déclenche la décision — une marque, un montant, un format —
 * mais une campagne dont on ne peut pas lire les attentes ne se choisit pas,
 * et un créateur dont on ne voit que la photo ne se retient pas non plus.
 *
 * ─── Pourquoi une feuille et pas une page ───
 * Changer de page casse le rythme du défilé : on perd sa place, on doit
 * revenir. La feuille se pose par-dessus et se referme sur la même carte.
 */

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-zinc-100 pt-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
        {titre}
      </h3>
      <div className="mt-2 text-[15px] leading-relaxed text-zinc-700">{children}</div>
    </section>
  );
}

function Enveloppe({
  onFermer,
  children,
}: {
  onFermer: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <div className="mx-auto max-w-md px-5 pb-28 pt-5">
        <button
          type="button"
          onClick={onFermer}
          className="sticky top-4 z-20 mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/45 text-lg text-white backdrop-blur transition hover:bg-black/65"
          aria-label="Fermer"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── un brief ───── */

export function FicheBrief({
  brief,
  onFermer,
}: {
  brief: BriefDefile;
  onFermer: () => void;
}) {
  const remuneration = remunerationLisible(brief);
  const echeance = brief.echeance
    ? new Date(brief.echeance).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const photo = photoDuBrief(brief);
  const base = brief.couleurMarque ?? "#1b1b21";

  return (
    <Enveloppe onFermer={onFermer}>
      {/* ═══ LA FICHE S'OUVRE SUR LE VISUEL ═══

          C'était une page blanche avec du texte : on touchait une carte pleine
          d'image et de couleur, et on atterrissait sur un document. La rupture
          était totale — « terriblement éloigné d'un site premium ».

          On repart donc de ce qu'on vient de toucher : la même photo, la même
          couleur, le même montant en grand. Le détail vient dessous, sur du
          blanc, parce que ça se LIT — mais on ne perd pas la marque en route. */}
      <div
        className="relative -mx-5 -mt-5 mb-6 aspect-[5/4] overflow-hidden"
        style={{ backgroundColor: assombrir(base, 0.42) }}
      >
        {photo ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${photo}")` }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(90% 65% at 25% 12%, ${eclaircir(base, 0.45)} 0%, ${assombrir(base, 0.5)} 72%)`,
            }}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-5">
          {brief.image && (
            <span
              className="h-11 w-11 shrink-0 rounded-xl bg-white bg-contain bg-center bg-no-repeat shadow-[0_6px_18px_-6px_rgba(0,0,0,.7)]"
              style={{ backgroundImage: `url("${brief.image}")` }}
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white/80">{brief.marque}</p>
            {remuneration && (
              <p className="font-display text-[38px] font-black leading-[0.9] tabular-nums tracking-tight text-white">
                {remuneration.gros}
                <span className="ml-2 align-middle text-[13px] font-semibold text-white/75">
                  {remuneration.petit}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <h2 className="font-display text-[26px] font-black leading-[1.12] tracking-tight text-ink">
        {brief.titre ?? "Collaboration"}
      </h2>
      {/* Le type ne figure pas sur la carte — une affiche se voit, elle ne se
          lit pas — mais il reste nécessaire pour comprendre ce qu'on signe. */}
      <span className="mt-3 inline-block rounded-full bg-purple-50 px-3 py-1 text-[12px] font-semibold text-purple-700">
        {LIBELLES_TYPE[brief.type] ?? brief.type}
      </span>

      <div className="mt-6 space-y-5">
        {brief.produit && <Bloc titre="Ce que la marque cherche">{brief.produit}</Bloc>}
        {brief.exigences && <Bloc titre="Ses attentes">{brief.exigences}</Bloc>}

        <Bloc titre="Conditions">
          <ul className="space-y-1.5">
            {echeance && <li>À livrer avant le {echeance}</li>}
            {brief.spots !== null && (
              <li>
                {brief.spots} place{brief.spots > 1 ? "s" : ""} sur cette campagne
              </li>
            )}
            {brief.audienceMini !== null && (
              <li>
                À partir de {brief.audienceMini.toLocaleString("fr-FR")} abonnés
              </li>
            )}
            <li className="text-zinc-500">
              Contrat généré automatiquement, paiement bloqué jusqu&apos;à la
              livraison, 0 % de commission pour toi.
            </li>
          </ul>
        </Bloc>
      </div>
    </Enveloppe>
  );
}

/* ─────────────────────────────────────────────────────── un créateur ───── */

export function FicheCreateur({
  createur,
  onFermer,
}: {
  createur: MarketplaceCreator;
  onFermer: () => void;
}) {
  const offres = createur.offers.map((id) => OFFER_BY_ID[id]).filter(Boolean);

  return (
    <Enveloppe onFermer={onFermer}>
      <div
        className="aspect-[4/3] w-full rounded-2xl bg-cover bg-center"
        style={{ backgroundImage: `url("${createur.photo}"), ${createur.tint}` }}
      />

      <h2 className="font-display mt-5 text-[26px] font-black leading-[1.12] tracking-tight text-ink">
        {createur.name}
      </h2>
      <p className="text-sm text-zinc-500">@{createur.handle}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-600">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <PlatformIcon slug={createur.platformSlug} className="h-4 w-4" />
          {createur.followers}
        </span>
        {createur.engagement !== "—" && <span>{createur.engagement} d&apos;engagement</span>}
        {createur.city && <span>{createur.city}</span>}
      </div>

      {createur.priceFrom !== null && (
        <p className="mt-5 font-display text-4xl font-black leading-none tabular-nums tracking-tight text-ink">
          dès {createur.priceFrom.toLocaleString("fr-FR")} €
        </p>
      )}

      <div className="mt-6 space-y-5">
        {createur.niches.length > 0 && (
          <Bloc titre="Ses sujets">
            <div className="flex flex-wrap gap-1.5">
              {createur.niches.map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-semibold text-emerald-700"
                >
                  {n}
                </span>
              ))}
            </div>
          </Bloc>
        )}

        {offres.length > 0 && (
          <Bloc titre="Ce qu'il propose">
            <div className="flex flex-wrap gap-1.5">
              {offres.map((o) => (
                <span
                  key={o.id}
                  className="rounded-full bg-purple-50 px-3 py-1 text-[13px] font-semibold text-purple-700"
                >
                  {o.emoji} {o.label}
                </span>
              ))}
            </div>
          </Bloc>
        )}

        {createur.platformLabels.length > 1 && (
          <Bloc titre="Où il publie">{createur.platformLabels.join(" · ")}</Bloc>
        )}

        <Bloc titre="Avis">
          {/* Jamais de note inventée : « pas encore d'avis » vaut mieux qu'un
              5,0 fabriqué, qui est exactement ce qui détruit la confiance
              dans une place de marché qui démarre. */}
          {createur.rating !== null
            ? `${createur.rating.toLocaleString("fr-FR")} / 5`
            : "Pas encore d'avis — ce créateur démarre sur Collabbs."}
        </Bloc>
      </div>
    </Enveloppe>
  );
}
