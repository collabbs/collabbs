"use client";

import { useRef, useState } from "react";
import type { BriefDefile } from "@/lib/defile";

/**
 * Une carte du défilé — pleine hauteur, qu'on attrape et qu'on jette.
 *
 * ─── Ce qui change par rapport à la première version ───
 * Elle occupe tout l'écran. Une vignette avec des boutons rectangulaires en
 * dessous, c'est une liste déguisée : on lit, on compare, on hésite. Une carte
 * pleine hauteur ne laisse qu'une chose à faire — trancher — et c'est de là
 * que vient le rythme.
 *
 * ─── Pourquoi les évènements « pointeur » ───
 * `pointerdown/move/up` couvrent le doigt, la souris et le stylet avec le même
 * code. Deux chemins séparés finiraient par diverger.
 *
 * ─── Les trois pièges du glissement ───
 * 1. `touch-action: none` : sans lui le navigateur prend le mouvement pour un
 *    défilement de page et la carte reste collée pendant que l'écran bouge.
 * 2. `setPointerCapture` : le geste continue quand le doigt sort de la carte.
 * 3. Aucune transition PENDANT le glissement, sinon la carte suit le doigt
 *    avec du retard. Elle ne s'anime qu'au relâchement.
 */

const SEUIL = 100;

const LIBELLES_TYPE: Record<string, string> = {
  video: "Vidéo postée",
  ugc: "Contenu UGC",
  affiliation: "Affiliation",
  performance: "Performance",
  hybrid: "Fixe + commission",
  cpa_tiers: "Paliers",
};

/**
 * Une teinte par campagne, dérivée de son identifiant.
 *
 * Une marque n'a pas de logo dans le questionnaire — téléverser avant d'avoir
 * un compte fait abandonner. Un dégradé identique sur toutes les cartes donne
 * alors l'impression d'un gabarit vide. Deux campagnes n'ont donc jamais la
 * même couleur, et celle d'une campagne ne change jamais d'un chargement à
 * l'autre : une couleur aléatoire donnerait l'impression que rien n'est décidé.
 */
function teinte(graine: string): { h: number } {
  let somme = 0;
  for (let i = 0; i < graine.length; i++) somme = (somme * 31 + graine.charCodeAt(i)) % 360;
  return { h: somme };
}

export type Direction = "gauche" | "droite";

/**
 * Deux textes disent-ils la même chose ?
 *
 * Les campagnes s'intitulent souvent comme leur propre description
 * (« Forfait garanti + commission » / « Un forfait garanti, plus une
 * commission… »). Empiler les deux donne une carte remplie au kilomètre.
 * Comparaison volontairement grossière — sans accents, sans ponctuation, sans
 * mots vides : on cherche une redite évidente, pas une similarité fine.
 */
function redit(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const nettoyer = (t: string) =>
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((m) => m.length > 3);
  const motsA = new Set(nettoyer(a));
  const motsB = nettoyer(b);
  if (motsA.size === 0 || motsB.length === 0) return false;
  const communs = motsB.filter((m) => motsA.has(m)).length;
  return communs / motsB.length > 0.6;
}

export function remunerationLisible(brief: BriefDefile) {
  const c = brief.commission;
  const taux = c ? (c.min === c.max ? `${c.min} %` : `${c.min}–${c.max} %`) : null;
  if (brief.montant !== null && taux) {
    return { gros: `${brief.montant.toLocaleString("fr-FR")} €`, petit: `+ ${taux} sur les ventes` };
  }
  if (brief.montant !== null) {
    return { gros: `${brief.montant.toLocaleString("fr-FR")} €`, petit: "par créateur" };
  }
  if (taux) return { gros: taux, petit: "de commission" };
  return null;
}

export default function CarteBrief({
  brief,
  onDecision,
  onOuvrir,
  sortirVers,
  /** Carte du dessous : visible mais inerte, elle donne l'épaisseur du paquet. */
  enArriere,
}: {
  brief: BriefDefile;
  onDecision?: (d: Direction) => void;
  /** Pression simple, sans glissement : on ouvre la fiche détaillée. */
  onOuvrir?: () => void;
  /**
   * Sortie commandée de l'extérieur, par les boutons ♥ et ✕.
   *
   * Sans ça, les boutons faisaient avancer la pile SANS que la carte parte :
   * elle disparaissait d'un coup et on ne voyait pas de quel côté. Le geste
   * animait, le bouton non — deux comportements pour une même décision.
   */
  sortirVers?: Direction | null;
  enArriere?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [glisse, setGlisse] = useState(false);
  const [sortie, setSortie] = useState<Direction | null>(null);
  const depart = useRef(0);
  // Distingue une PRESSION d'un GLISSEMENT : sans ça, ouvrir la fiche au
  // toucher déclencherait aussi une décision, et inversement.
  const aBouge = useRef(false);

  const sortieEffective = sortie ?? sortirVers ?? null;
  const inerte = enArriere || sortieEffective !== null;

  function commencer(e: React.PointerEvent) {
    if (inerte || !onDecision) return;
    depart.current = e.clientX;
    aBouge.current = false;
    setGlisse(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* certains navigateurs refusent la capture : le geste marche quand même */
    }
  }

  function bouger(e: React.PointerEvent) {
    if (!glisse) return;
    const ecart = e.clientX - depart.current;
    // 6 px de tolérance : un doigt n'est jamais parfaitement immobile, et sans
    // cette marge une pression normale passerait pour un micro-glissement.
    if (Math.abs(ecart) > 6) aBouge.current = true;
    setDx(ecart);
  }

  function relacher() {
    if (!glisse) return;
    setGlisse(false);
    if (!aBouge.current) {
      setDx(0);
      onOuvrir?.();
      return;
    }
    if (Math.abs(dx) >= SEUIL) {
      const dir: Direction = dx > 0 ? "droite" : "gauche";
      setSortie(dir);
      window.setTimeout(() => onDecision?.(dir), 240);
    } else {
      setDx(0);
    }
  }

  const rotation = Math.max(-16, Math.min(16, dx / 14));
  const intensite = Math.min(1, Math.abs(dx) / SEUIL);
  const remuneration = remunerationLisible(brief);
  const { h } = teinte(brief.id);

  const transform = sortieEffective
    ? `translateX(${sortieEffective === "droite" ? 900 : -900}px) rotate(${sortieEffective === "droite" ? 26 : -26}deg)`
    : enArriere
      ? "scale(0.95) translateY(10px)"
      : `translateX(${dx}px) rotate(${rotation}deg)`;

  return (
    <div
      onPointerDown={commencer}
      onPointerMove={bouger}
      onPointerUp={relacher}
      onPointerCancel={relacher}
      style={{
        transform,
        transition: glisse ? "none" : "transform .24s cubic-bezier(.22,.61,.36,1), opacity .2s",
        touchAction: "none",
        opacity: sortieEffective ? 0 : 1,
      }}
      className={`absolute inset-0 select-none overflow-hidden rounded-[28px] shadow-[0_20px_60px_-24px_rgba(0,0,0,.55)] ${
        enArriere ? "pointer-events-none" : ""
      } ${inerte ? "" : "cursor-grab active:cursor-grabbing"}`}
    >
      {/* Fond propre à la campagne. Plus clair qu'avant : la carte servait de
          faire-valoir à un grand vide sombre, alors qu'elle doit se lire. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(160deg, hsl(${h} 58% 26%), hsl(${(h + 40) % 360} 66% 44%))`,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_20%_0%,rgba(255,255,255,.24),transparent_55%)]" />

      {/* Tampons de décision : ils disent ce qui va se passer AVANT de lâcher. */}
      {!enArriere && (
        <>
          <span
            style={{ opacity: dx > 0 ? intensite : 0 }}
            className="pointer-events-none absolute left-6 top-8 z-20 -rotate-[14deg] rounded-2xl border-4 border-emerald-400 px-4 py-1.5 text-xl font-black uppercase tracking-wider text-emerald-400"
          >
            Intéressé
          </span>
          <span
            style={{ opacity: dx < 0 ? intensite : 0 }}
            className="pointer-events-none absolute right-6 top-8 z-20 rotate-[14deg] rounded-2xl border-4 border-rose-400 px-4 py-1.5 text-xl font-black uppercase tracking-wider text-rose-400"
          >
            Passer
          </span>
        </>
      )}

      {/* ─── La hiérarchie, entièrement revue ───
          Le nom de la marque était l'élément le plus GROS de la carte. Il ne
          dit pourtant rien à un créateur — et tant qu'une seule marque publie,
          toutes les cartes affichaient le même mot en géant. Le montant, lui,
          était écrit petit, en bas.

          C'est l'inverse : un créateur qui fait défiler se demande combien, et
          pour quoi. Le montant devient donc le sujet, la mission vient juste
          après, et la marque redescend au rang d'étiquette. */}
      {/* Voile bas : le texte reste lisible quelle que soit la teinte tirée. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent" />

      <div className="pointer-events-none absolute inset-0 flex flex-col p-6">
        {/* Étiquette du haut : qui, et quel type de collaboration. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-bold text-white backdrop-blur">
            {brief.marque}
          </span>
          <span className="rounded-full bg-black/25 px-3 py-1 text-[12px] font-semibold text-white/85 backdrop-blur">
            {LIBELLES_TYPE[brief.type] ?? brief.type}
          </span>
          {brief.dejaInteressee && (
            <span className="rounded-full bg-emerald-400 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-950">
              T&apos;a repéré
            </span>
          )}
        </div>

        {/* Le contenu est ancré EN BAS, pas centré. Centré, il laissait un
            vide égal au-dessus et au-dessous, ce qui donnait une carte à
            moitié remplie. En bas, le vide du haut devient une respiration
            voulue — c'est la disposition de toutes les applications de ce
            genre, et pour cette raison. */}
        <div className="flex flex-1 flex-col justify-end">
          {remuneration ? (
            <>
              <p className="font-display text-[68px] font-black leading-[0.88] tracking-[-0.04em] text-white [overflow-wrap:anywhere]">
                {remuneration.gros}
              </p>
              <p className="mt-1.5 text-[15px] font-semibold text-white/70">
                {remuneration.petit}
              </p>
            </>
          ) : (
            <p className="font-display text-[40px] font-black leading-none tracking-tight text-white/70">
              À négocier
            </p>
          )}

          {/* La mission : ce qu'il y a à faire, en clair. Sans elle on sait
              combien on gagne, mais pas ce qu'on doit livrer. */}
          {brief.titre && (
            <p className="mt-6 line-clamp-2 text-[19px] font-bold leading-snug text-white">
              {brief.titre}
            </p>
          )}
          {/* On masque la description quand elle ne fait que redire le titre.
              Trois formulations de la même chose empilées donnent l'impression
              d'une carte remplie au kilomètre. */}
          {brief.produit && !redit(brief.titre, brief.produit) && (
            <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-white/70">
              {brief.produit}
            </p>
          )}

          {/* Les niches visées : un créateur sait immédiatement si c'est pour
              lui. C'est l'information qui manquait le plus. */}
          {brief.niches.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {brief.niches.slice(0, 4).map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold text-white/90 backdrop-blur"
                >
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Le contexte, en bas, discret : ce qui cadre sans détourner. */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-medium text-white/60">
          {brief.echeance && (
            <span>
              Avant le{" "}
              {new Date(brief.echeance).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
          {brief.spots !== null && (
            <span>
              {brief.spots} place{brief.spots > 1 ? "s" : ""}
            </span>
          )}
          {brief.audienceMini !== null && (
            <span>dès {brief.audienceMini.toLocaleString("fr-FR")} abonnés</span>
          )}
          <span className="ml-auto text-white/45">Touche pour en lire plus</span>
        </div>
      </div>

    </div>
  );
}
