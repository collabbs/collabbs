import { describe, it, expect } from "vitest";
import { termesDealSchema, formatDealSchema } from "@/lib/schemas/deals";
import { DEAL_FORMAT_LABEL, type DealFormat } from "@/lib/deal";

/**
 * Le format était figé à « vidéo postée » pour toute proposition directe, et
 * modifiable nulle part. Une marque qui commandait trois stories signait un
 * contrat annonçant une vidéo — faux dans le document qui fait foi.
 */
describe("format d'une collaboration", () => {
  it("les cinq formats du produit sont acceptés", () => {
    for (const f of Object.keys(DEAL_FORMAT_LABEL) as DealFormat[]) {
      expect(formatDealSchema.safeParse(f).success).toBe(true);
    }
  });

  it("chaque format a un libellé lisible — jamais un nom de colonne", () => {
    for (const [cle, libelle] of Object.entries(DEAL_FORMAT_LABEL)) {
      expect(libelle).not.toBe(cle);
      expect(libelle).not.toMatch(/_/);
    }
  });

  it("un format inventé est refusé", () => {
    for (const f of ["tiktok", "VIDEO_POST", "", "podcast"]) {
      expect(formatDealSchema.safeParse(f).success).toBe(false);
    }
  });

  it("les termes acceptent un format, et s'en passent", () => {
    const base = { amount: 200, quantity: 2, deadline: null, brandNotes: null };
    expect(termesDealSchema.safeParse({ ...base, format: "story" }).success).toBe(true);
    // Absent, il ne bloque rien : les écrans qui ne le touchent pas continuent.
    expect(termesDealSchema.safeParse(base).success).toBe(true);
  });

  it("un format invalide fait échouer les termes entiers", () => {
    const r = termesDealSchema.safeParse({
      amount: 200, quantity: 1, deadline: null, brandNotes: null, format: "podcast",
    });
    expect(r.success).toBe(false);
  });
});
