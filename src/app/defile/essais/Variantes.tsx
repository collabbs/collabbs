"use client";

import type { BriefDefile } from "@/lib/defile";
import { LIBELLES_TYPE } from "@/lib/collaboration";
import { remunerationLisible } from "../CarteBrief";

/**
 * Cinq directions artistiques, sur la même campagne.
 *
 * Écrit parce que j'itérais depuis une heure à l'intérieur d'une seule idée —
 * fond sombre, logo au centre, texte en bas — en changeant les détails sans
 * jamais changer de parti. Cinq propositions vraiment distinctes valent mieux
 * qu'une sixième variation.
 *
 * Chacune est complète et jouable : ce ne sont pas des esquisses, c'est le
 * même contenu traité cinq fois. On choisit en regardant, pas en imaginant.
 */

const CADRE = "relative aspect-[3/4] w-full overflow-hidden rounded-[24px]";

/* ══════════════════════════════════════════════════════════ 1. ÉDITORIAL ══
   Papier blanc, encre noire, une règle, un accent. L'exact opposé du sombre :
   ce qui fait « premium » ici n'est pas la profondeur mais la RETENUE — de la
   marge, une hiérarchie franche, et rien de décoratif. La référence est
   l'affiche suisse et la presse imprimée. */
export function Editorial({ brief }: { brief: BriefDefile }) {
  const r = remunerationLisible(brief);
  return (
    <div className={`${CADRE} border border-zinc-200 bg-white`}>
      <div className="flex h-full flex-col p-6">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            {LIBELLES_TYPE[brief.type] ?? brief.type}
          </span>
          {brief.image && (
            <span
              className="h-10 w-10 rounded-lg bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url("${brief.image}")` }}
            />
          )}
        </div>

        <div className="mt-auto">
          <div className="h-px w-full bg-ink" />
          <p className="font-display mt-4 text-[64px] font-black leading-[0.85] tracking-[-0.05em] text-ink">
            {r?.gros ?? "—"}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-zinc-500">{r?.petit}</p>

          <p className="font-display mt-6 text-[20px] font-black leading-tight tracking-tight text-ink">
            {brief.marque}
          </p>
          {brief.titre && (
            <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-zinc-500">
              {brief.titre}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ 2. APLAT SATURÉ ══
   Une seule couleur franche, texte noir, aucune profondeur. C'est la carte
   qui se voit de loin dans un fil : elle ne cherche pas la finesse, elle
   cherche l'arrêt. La référence est l'autocollant et la pochette de single. */
export function Aplat({ brief }: { brief: BriefDefile }) {
  const r = remunerationLisible(brief);
  return (
    <div className={CADRE} style={{ background: "#D6FF3E" }}>
      <div className="flex h-full flex-col justify-between p-6">
        <div className="flex items-center gap-3">
          {brief.image && (
            <span
              className="h-11 w-11 rounded-xl bg-white bg-contain bg-center bg-no-repeat ring-1 ring-black/10"
              style={{ backgroundImage: `url("${brief.image}")` }}
            />
          )}
          <span className="font-display text-[19px] font-black tracking-tight text-black">
            {brief.marque}
          </span>
        </div>

        <div>
          <p className="font-display text-[72px] font-black leading-[0.8] tracking-[-0.06em] text-black">
            {r?.gros ?? "—"}
          </p>
          <p className="mt-2 text-[15px] font-bold text-black/60">{r?.petit}</p>
        </div>

        <div>
          {brief.titre && (
            <p className="line-clamp-2 text-[16px] font-bold leading-snug text-black">
              {brief.titre}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {brief.niches.slice(0, 3).map((n) => (
              <span
                key={n}
                className="rounded-full bg-black px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#D6FF3E]"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════ 3. CHIFFRE PLEIN ══
   Le montant EST la carte : il déborde, il est coupé par les bords. Tout le
   reste tient en marge. C'est la proposition la plus brutale, et la plus
   lisible à petite taille — dans une vidéo, on ne verra que le chiffre, et
   c'est exactement ce qu'on veut faire retenir. */
export function ChiffrePlein({ brief }: { brief: BriefDefile }) {
  const r = remunerationLisible(brief);
  return (
    <div className={`${CADRE} bg-ink`}>
      <p className="font-display absolute -left-2 top-1/2 -translate-y-1/2 text-[128px] font-black leading-[0.75] tracking-[-0.07em] text-white/95 [overflow-wrap:anywhere]">
        {r?.gros ?? "—"}
      </p>
      <div className="absolute inset-x-0 top-0 flex items-center gap-2.5 p-5">
        {brief.image && (
          <span
            className="h-9 w-9 rounded-lg bg-white bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url("${brief.image}")` }}
          />
        )}
        <span className="font-display text-[15px] font-black tracking-tight text-white">
          {brief.marque}
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          {r?.petit}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5">
        {brief.titre && (
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-white/80">
            {brief.titre}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════ 4. SCINDÉE ══
   Deux zones franches : la marque en haut sur SA couleur, l'offre en bas sur
   du blanc. La division est le principe — on voit d'un coup qui propose et ce
   qu'on gagne, sans avoir à lire. La référence est la carte d'embarquement. */
export function Scindee({ brief }: { brief: BriefDefile }) {
  const r = remunerationLisible(brief);
  return (
    <div className={`${CADRE} bg-white`}>
      <div
        className="flex h-[46%] flex-col items-center justify-center gap-3"
        style={{ background: brief.couleurMarque ?? "#09090b" }}
      >
        {brief.image && (
          <span
            className="h-16 w-16 rounded-2xl bg-white bg-contain bg-center bg-no-repeat shadow-lg"
            style={{ backgroundImage: `url("${brief.image}")` }}
          />
        )}
        <span className="font-display text-[20px] font-black tracking-tight text-white">
          {brief.marque}
        </span>
      </div>

      <div className="flex h-[54%] flex-col justify-between p-5">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">
            Tu gagnes
          </p>
          <p className="font-display mt-1.5 text-[52px] font-black leading-[0.85] tracking-[-0.05em] text-ink">
            {r?.gros ?? "—"}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-zinc-500">{r?.petit}</p>
        </div>
        {brief.titre && (
          <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-zinc-700">
            {brief.titre}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ 5. VITRINE ══
   Le logo occupe presque tout, très grand, sur un fond clair neutre — comme
   un produit en vitrine. Le chiffre est une pastille posée dessus. C'est la
   proposition qui met la MARQUE au premier plan plutôt que l'argent : celle
   qu'un créateur reconnaît avant même de lire. */
export function Vitrine({ brief }: { brief: BriefDefile }) {
  const r = remunerationLisible(brief);
  return (
    <div className={`${CADRE} bg-[#F2F0EE]`}>
      {brief.image ? (
        <span
          className="absolute left-1/2 top-[42%] h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${brief.image}")` }}
        />
      ) : (
        <span className="font-display absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-[110px] font-black text-ink/15">
          {brief.marque.slice(0, 1).toUpperCase()}
        </span>
      )}

      <span className="absolute right-4 top-4 rounded-full bg-ink px-4 py-2 font-display text-[22px] font-black tracking-tight text-white">
        {r?.gros ?? "—"}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="font-display text-[22px] font-black leading-tight tracking-tight text-ink">
          {brief.marque}
        </p>
        {brief.titre && (
          <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-zinc-500">
            {brief.titre}
          </p>
        )}
      </div>
    </div>
  );
}
