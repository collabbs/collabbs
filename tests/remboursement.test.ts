import { describe, it, expect } from "vitest";
import { peutRembourser, JOURS_AVANT_ABANDON } from "@/lib/remboursement";

const T0 = new Date("2026-09-03T12:00:00Z").getTime();
const JOUR = 86_400_000;
const neuf = {
  submitted_at: null,
  done: false,
  revision_requested: false,
  updated_at: "2026-09-03T12:00:00Z",
};
const livre = { ...neuf, submitted_at: "2026-09-01T10:00:00Z", done: true };

describe("peutRembourser", () => {
  it("autorise tant que rien n'est livré", () => {
    expect(peutRembourser([]).autorise).toBe(true);
    expect(peutRembourser([neuf, neuf]).autorise).toBe(true);
  });

  it("refuse dès qu'un livrable est déposé", () => {
    // Le scénario que ceci empêche : la marque règle, le créateur publie la
    // vidéo, la marque reprend son argent.
    const r = peutRembourser([neuf, { ...neuf, submitted_at: "2026-09-03T10:00:00Z" }], T0);
    expect(r.autorise).toBe(false);
    if (!r.autorise) expect(r.motif).toContain("déjà livré");
  });

  it("refuse aussi quand le créateur a coché « terminé » sans dépôt", () => {
    // Une story expire, un post est déjà en ligne : la preuve est ailleurs,
    // mais le travail est fait.
    expect(peutRembourser([{ ...neuf, done: true }], T0).autorise).toBe(false);
  });

  it("suffit d'UN seul livrable déposé sur plusieurs", () => {
    const r = peutRembourser([neuf, neuf, { ...neuf, submitted_at: "2026-09-03T10:00:00Z" }], T0);
    expect(r.autorise).toBe(false);
  });
});

describe("peutRembourser — l'impasse de la retouche sans réponse", () => {
  // Sans cette issue, le scénario « le créateur livre mal, la marque demande
  // une retouche, le créateur disparaît » bloquait les fonds pour toujours :
  // libération automatique interdite, remboursement interdit, clôture
  // impossible.
  const enRetouche = (jourDemande: number) => ({
    ...livre,
    revision_requested: true,
    updated_at: new Date(T0 - jourDemande * JOUR).toISOString(),
  });

  it("refuse tant que le créateur a encore le temps de répondre", () => {
    expect(peutRembourser([enRetouche(1)], T0).autorise).toBe(false);
    expect(peutRembourser([enRetouche(JOURS_AVANT_ABANDON - 1)], T0).autorise).toBe(false);
  });

  it("autorise une fois le délai écoulé sans réponse", () => {
    expect(peutRembourser([enRetouche(JOURS_AVANT_ABANDON)], T0).autorise).toBe(true);
    expect(peutRembourser([enRetouche(60)], T0).autorise).toBe(true);
  });

  it("se referme dès que le créateur redépose", () => {
    // Le créateur a répondu : `revision_requested` retombe à faux. La marque
    // ne doit plus pouvoir reprendre ses fonds — sinon la faille d'origine
    // se rouvrirait, avec une demande de retouche bidon comme prétexte.
    expect(peutRembourser([{ ...livre, revision_requested: false }], T0).autorise).toBe(false);
  });

  it("exige que TOUS les livrables en retouche soient dépassés", () => {
    // Un seul livrable encore dans les temps suffit à protéger le créateur.
    const r = peutRembourser([enRetouche(60), enRetouche(2)], T0);
    expect(r.autorise).toBe(false);
  });
});

/**
 * ─── Le maillon qui manquait, et que ces tests seuls ne pouvaient pas voir ───
 *
 * `peutRembourser` était juste. Les huit tests au-dessus passaient. Et le
 * produit était cassé quand même, parce que la valeur qu'on lui passait ne
 * changeait jamais : `revision_requested` passait à vrai dans `requestRevision`
 * et AUCUN code ne le remettait à faux — alors que le commentaire de ce
 * fichier-ci affirme « dès que le créateur redépose, `revision_requested`
 * retombe à faux et le remboursement se referme ».
 *
 * On testait donc parfaitement une fonction alimentée par une donnée figée.
 * Ce que les tests suivants vérifient, ce n'est plus le calcul : c'est que les
 * deux états que le produit sait produire donnent bien les deux verdicts
 * attendus. Le premier était jouable en vrai, le second ne l'était pas.
 */
describe("le va-et-vient d'une retouche", () => {
  const ancien = new Date("2026-08-01T10:00:00Z").toISOString();
  const maintenant = new Date("2026-09-09T10:00:00Z").getTime();

  it("laisse la marque reprendre ses fonds si le créateur ne répond jamais", () => {
    const v = peutRembourser(
      [{ submitted_at: ancien, done: false, revision_requested: true, updated_at: ancien }],
      maintenant,
    );
    expect(v.autorise).toBe(true);
  });

  it("referme le remboursement dès que le créateur a redéposé", () => {
    // L'état exact que produit aujourd'hui `setDeliverableSubmission` : le
    // dépôt remet `revision_requested` à faux. Avant la correction, ce drapeau
    // restait à vrai pour toujours — et la marque pouvait se faire rembourser
    // l'intégralité alors que la vidéo était en ligne.
    const v = peutRembourser(
      [{ submitted_at: ancien, done: true, revision_requested: false, updated_at: ancien }],
      maintenant,
    );
    expect(v.autorise).toBe(false);
  });

  it("un seul livrable encore en attente ne suffit pas si un autre vient d'être redéposé", () => {
    // `tousDepasses` : on ne rembourse que si TOUTES les retouches en cours
    // ont dépassé le délai. Un créateur qui répond sur une partie du travail
    // n'a pas abandonné.
    const hier = new Date("2026-09-08T10:00:00Z").toISOString();
    const v = peutRembourser(
      [
        { submitted_at: ancien, done: false, revision_requested: true, updated_at: ancien },
        { submitted_at: hier, done: false, revision_requested: true, updated_at: hier },
      ],
      maintenant,
    );
    expect(v.autorise).toBe(false);
  });
});
