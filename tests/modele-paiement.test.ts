import { describe, expect, it } from "vitest";
import { modeleDePaiement, remunerationDeduite } from "@/lib/quiz";

/**
 * Le defaut corrige : on demandait le format, puis on posait une question de
 * remuneration identique quel que soit ce format. Une marque pouvait choisir
 * « Affiliation 1 clic » puis « un montant fixe » — et sa carte annoncait un
 * forfait pour une campagne qui n'en a pas.
 */
describe("modeleDePaiement", () => {
  it("un format au forfait ne demande pas de commission", () => {
    expect(modeleDePaiement(["ugc"])).toEqual({ fixe: true, commission: false });
    expect(modeleDePaiement(["story"])).toEqual({ fixe: true, commission: false });
  });

  it("l'affiliation ne demande pas de forfait", () => {
    expect(modeleDePaiement(["affil"])).toEqual({ fixe: false, commission: true });
  });

  it("la performance se règle comme une commission", () => {
    // « Variable » et « Commission » se paient tous deux sur le résultat :
    // une seule question couvre les deux.
    expect(modeleDePaiement(["perf"])).toEqual({ fixe: false, commission: true });
  });

  it("un mélange demande bien les deux", () => {
    expect(modeleDePaiement(["ugc", "affil"])).toEqual({ fixe: true, commission: true });
  });

  it("ne demande rien tant qu'aucun format n'est choisi", () => {
    expect(modeleDePaiement([])).toEqual({ fixe: false, commission: false });
    expect(remunerationDeduite([])).toBeNull();
  });
});

describe("remunerationDeduite", () => {
  it("traduit le croisement en mode de rémunération", () => {
    expect(remunerationDeduite(["ugc"])).toBe("fixe");
    expect(remunerationDeduite(["affil"])).toBe("commission");
    expect(remunerationDeduite(["post", "perf"])).toBe("les-deux");
  });
});
