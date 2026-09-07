/**
 * Le vocabulaire visuel du parcours d'entrée.
 *
 * ─── Ce qu'on a appris en regardant le tunnel Noom ───
 * Sa qualité ne vient pas de la décoration : il n'y a AUCUNE illustration sur
 * ses écrans de question. Elle vient de la retenue. Trois écarts mesurés avec
 * ce que j'avais construit :
 *
 *  - **Le titre est calme.** 20 px en graisse NORMALE chez eux. J'étais à
 *    34 px en graisse maximale — un titre qui crie, là où il faut une phrase
 *    qu'on lit.
 *  - **Les boutons sont des surfaces pleines et douces** (#F6F4EE), à coins
 *    presque droits, hauteur 62 px. J'avais des cartes blanches bordées de
 *    gris : ça ressemble à un formulaire d'administration.
 *  - **Le fond est chaud**, jamais blanc pur.
 *
 * On garde la DA Collabbs — l'accent violet, Bricolage pour les titres — mais
 * on emprunte cette économie de moyens. Les neutres sont légèrement teintés
 * violet plutôt que gris : un gris pur à côté d'un accent violet paraît sale.
 */

/** Fond de page : blanc cassé tiède, jamais #FFF. */
export const FOND = "bg-[#FCFAFB]";

/** Titre de question : une phrase qu'on lit, pas une accroche qui crie. */
export const TITRE =
  "font-display text-[23px] font-semibold leading-[1.32] tracking-[-0.01em] text-ink sm:text-[27px]";

/** Intitulé de section, au-dessus du titre. */
export const SECTION =
  "text-[11px] font-semibold uppercase tracking-[0.18em] text-brand";

/** Phrase d'aide sous le titre. */
export const AIDE = "mt-2.5 text-[15px] leading-relaxed text-zinc-500";

/** Une réponse : surface pleine, douce, grande cible. */
export const REPONSE =
  "flex min-h-[62px] w-full items-center justify-between gap-3 rounded-xl border-2 border-transparent bg-[#F4F1F5] px-5 py-4 text-left text-[16px] font-medium text-ink transition hover:bg-[#EDE8F0]";

/** La même, choisie : on souligne d'un liseré, on n'inverse pas tout. */
export const REPONSE_ACTIVE =
  "flex min-h-[62px] w-full items-center justify-between gap-3 rounded-xl border-2 border-brand bg-white px-5 py-4 text-left text-[16px] font-semibold text-ink shadow-[0_2px_10px_-4px_rgba(124,58,237,.45)]";

/** Petite pastille de choix multiple (niches, réseaux). */
export const PASTILLE =
  "min-h-[46px] rounded-xl border-2 border-transparent bg-[#F4F1F5] px-4 text-[15px] font-medium text-zinc-700 transition hover:bg-[#EDE8F0]";

export const PASTILLE_ACTIVE =
  "min-h-[46px] rounded-xl border-2 border-brand bg-white px-4 text-[15px] font-semibold text-ink";

/** Champ de saisie. */
export const CHAMP =
  "min-h-[62px] w-full rounded-xl border-2 border-transparent bg-[#F4F1F5] px-5 text-[16px] text-ink outline-none transition placeholder:text-zinc-400 focus:border-brand focus:bg-white";

/** Bouton d'avancement. */
export const PRINCIPAL =
  "min-h-[58px] w-full rounded-xl bg-ink px-6 text-[16px] font-semibold text-white transition hover:opacity-90 disabled:opacity-25";

/** Sortie discrète, en bas d'écran. */
export const DISCRET =
  "text-[14px] font-medium text-zinc-400 transition hover:text-ink";
