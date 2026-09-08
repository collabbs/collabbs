import { describe, expect, it } from "vitest";
import {
  modeleDePaiement,
  montantMisEnAvant,
  prixParFormat,
  remunerationDeduite,
} from "@/lib/quiz";

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

describe("montantMisEnAvant", () => {
  it("annonce le PLUS BAS quand plusieurs formats ont leur prix", () => {
    // Une marque ne doit jamais promettre plus que ce qu'elle paiera pour le
    // format le moins cher : gonfler le chiffre ferait cliquer davantage et
    // décevrait autant.
    expect(montantMisEnAvant({ ugc: 400, story: 150 })).toBe(150);
  });

  it("rend le montant unique quand il n'y en a qu'un", () => {
    expect(montantMisEnAvant({ ugc: 400 })).toBe(400);
  });

  it("ne rend rien quand aucun prix n'est posé", () => {
    expect(montantMisEnAvant({})).toBeNull();
    expect(montantMisEnAvant({ ugc: 0 })).toBeNull();
  });
});

describe("prixParFormat", () => {
  it("répare ce qui vient du navigateur", () => {
    expect(prixParFormat({ ugc: "400", story: 150 })).toEqual({ ugc: 400, story: 150 });
  });

  it("écarte les formats inconnus et les valeurs absurdes", () => {
    expect(prixParFormat({ inexistant: 400, ugc: -5, story: "abc", post: 90 })).toEqual({
      post: 90,
    });
  });

  it("survit à n'importe quoi", () => {
    expect(prixParFormat(null)).toEqual({});
    expect(prixParFormat("cassé")).toEqual({});
  });
});
