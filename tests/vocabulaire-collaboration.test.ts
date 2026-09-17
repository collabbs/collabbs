import { describe, it, expect } from "vitest";
import { LIBELLES_TYPE } from "@/lib/collaboration";
import { MODELE_LABEL, DEAL_FORMAT_LABEL } from "@/lib/deal";

/**
 * Le produit a deux portes — la campagne et la proposition directe — et il
 * parlait deux langues. Côté campagne, « Vidéo postée » et « Affiliation »
 * figuraient dans la MÊME liste : deux réponses à deux questions
 * différentes. Une marque qui comparait ne pouvait pas choisir.
 */
describe("un seul vocabulaire des deux côtés", () => {
  it("un type de campagne décrit un paiement, jamais un contenu", () => {
    const formats = Object.values(DEAL_FORMAT_LABEL);
    for (const [cle, libelle] of Object.entries(LIBELLES_TYPE)) {
      expect(formats, `« ${libelle} » (${cle}) décrit un contenu`).not.toContain(libelle);
    }
  });

  it("les modèles communs se disent avec les mêmes mots", () => {
    expect(LIBELLES_TYPE.affiliation).toBe(MODELE_LABEL.affiliation);
    expect(LIBELLES_TYPE.hybrid).toBe(MODELE_LABEL.hybride);
    expect(LIBELLES_TYPE.performance).toBe(MODELE_LABEL.performance);
    expect(LIBELLES_TYPE.video).toBe(MODELE_LABEL.forfait);
  });

  it("aucun libellé ne reste un nom de colonne", () => {
    for (const [cle, libelle] of Object.entries(LIBELLES_TYPE)) {
      expect(libelle).not.toBe(cle);
      expect(libelle).not.toMatch(/_/);
    }
  });
});
