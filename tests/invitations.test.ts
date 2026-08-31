import { describe, it, expect } from "vitest";
import {
  decideur,
  peutDecider,
  createursAInviter,
  resumeInvitations,
} from "@/lib/invitations";

describe("qui tranche", () => {
  it("une candidature se décide par la marque, une invitation par le créateur", () => {
    expect(decideur("creator")).toBe("brand");
    expect(decideur("brand")).toBe("creator");
  });

  it("la marque ne peut pas accepter sa propre invitation à la place du créateur", () => {
    expect(peutDecider("brand", "brand", "pending")).toBe(false);
    expect(peutDecider("creator", "brand", "pending")).toBe(true);
  });

  it("le créateur ne peut pas accepter sa propre candidature à la place de la marque", () => {
    expect(peutDecider("creator", "creator", "pending")).toBe(false);
    expect(peutDecider("brand", "creator", "pending")).toBe(true);
  });

  it("rien ne se décide deux fois", () => {
    expect(peutDecider("brand", "creator", "accepted")).toBe(false);
    expect(peutDecider("creator", "brand", "rejected")).toBe(false);
  });
});

describe("tri des créateurs à inviter", () => {
  it("écarte ceux qui sont déjà en relation avec la campagne", () => {
    const { aInviter, ignores } = createursAInviter(["a", "b", "c"], ["b"]);
    expect(aInviter).toEqual(["a", "c"]);
    expect(ignores).toEqual(["b"]);
  });

  it("ne compte un doublon de formulaire qu'une seule fois", () => {
    const { aInviter, ignores } = createursAInviter(["a", "a", "a"], []);
    expect(aInviter).toEqual(["a"]);
    expect(ignores).toEqual([]);
  });

  it("un doublon déjà en relation ne gonfle pas non plus le compte des ignorés", () => {
    const { aInviter, ignores } = createursAInviter(["b", "b"], ["b"]);
    expect(aInviter).toEqual([]);
    expect(ignores).toEqual(["b"]);
  });

  it("conserve l'ordre de la sélection", () => {
    const { aInviter } = createursAInviter(["c", "a", "b"], []);
    expect(aInviter).toEqual(["c", "a", "b"]);
  });

  it("une sélection vide ne produit rien", () => {
    expect(createursAInviter([], ["a"])).toEqual({ aInviter: [], ignores: [] });
  });
});

describe("compte rendu à la marque", () => {
  it("dit combien sont partis et combien ont été écartés", () => {
    expect(resumeInvitations(2, 3)).toBe(
      "2 invitations envoyées. 3 créateurs étaient déjà en relation avec cette campagne.",
    );
  });

  it("accorde le singulier", () => {
    expect(resumeInvitations(1, 1)).toBe(
      "Invitation envoyée. 1 créateur était déjà en relation avec cette campagne.",
    );
  });

  it("n'ajoute rien quand tout est parti", () => {
    expect(resumeInvitations(3, 0)).toBe("3 invitations envoyées.");
  });

  it("explique le cas où rien n'est parti plutôt que d'annoncer un succès vide", () => {
    expect(resumeInvitations(0, 1)).toBe(
      "Ce créateur est déjà en relation avec cette campagne.",
    );
    expect(resumeInvitations(0, 4)).toBe(
      "Ces 4 créateurs sont déjà en relation avec cette campagne.",
    );
  });

  it("distingue « rien à faire » de « rien sélectionné »", () => {
    expect(resumeInvitations(0, 0)).toBe("Aucun créateur sélectionné.");
  });
});

describe("candidature retirée", () => {
  it("une candidature retirée ne se décide plus, par personne", () => {
    expect(peutDecider("brand", "creator", "withdrawn")).toBe(false);
    expect(peutDecider("creator", "brand", "withdrawn")).toBe(false);
  });
});
