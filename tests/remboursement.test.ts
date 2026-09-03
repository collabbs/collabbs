import { describe, it, expect } from "vitest";
import { peutRembourser } from "@/lib/remboursement";

const neuf = { submitted_at: null, done: false };

describe("peutRembourser", () => {
  it("autorise tant que rien n'est livré", () => {
    expect(peutRembourser([]).autorise).toBe(true);
    expect(peutRembourser([neuf, neuf]).autorise).toBe(true);
  });

  it("refuse dès qu'un livrable est déposé", () => {
    // Le scénario que ceci empêche : la marque règle, le créateur publie la
    // vidéo, la marque reprend son argent.
    const r = peutRembourser([neuf, { submitted_at: "2026-09-03T10:00:00Z", done: false }]);
    expect(r.autorise).toBe(false);
    if (!r.autorise) expect(r.motif).toContain("déjà livré");
  });

  it("refuse aussi quand le créateur a coché « terminé » sans dépôt", () => {
    // Une story expire, un post est déjà en ligne : la preuve est ailleurs,
    // mais le travail est fait.
    expect(peutRembourser([{ submitted_at: null, done: true }]).autorise).toBe(false);
  });

  it("suffit d'UN seul livrable déposé sur plusieurs", () => {
    const r = peutRembourser([neuf, neuf, { submitted_at: "2026-09-03T10:00:00Z", done: false }]);
    expect(r.autorise).toBe(false);
  });
});
