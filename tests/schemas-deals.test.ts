import { describe, it, expect } from "vitest";
import { termesDealSchema, DEAL_MONTANT_MAX } from "@/lib/schemas/deals";
import { valider } from "@/lib/validation";

/**
 * `updateDealTerms` écrivait `Math.max(0, Math.round(data.amount))` : trois
 * comportements silencieux sur de l'argent. Une marque qui saisissait 1 400,50
 * obtenait 1 400 sans un mot, un montant négatif devenait une collaboration
 * gratuite, et rien ne bornait le haut.
 */

const base = {
  amount: 1400,
  quantity: 2,
  deadline: "2026-09-30",
  brandNotes: "Tournage en extérieur.",
};

describe("termes d'une collaboration", () => {
  it("accepte des termes normaux", () => {
    expect(valider(termesDealSchema, base).ok).toBe(true);
  });

  it("refuse un montant à virgule au lieu de l'arrondir en douce", () => {
    const r = valider(termesDealSchema, { ...base, amount: 1400.5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("entier");
  });

  it("refuse un montant négatif au lieu d'en faire une collaboration gratuite", () => {
    expect(valider(termesDealSchema, { ...base, amount: -100 }).ok).toBe(false);
  });

  it("refuse une collaboration à zéro euro", () => {
    expect(valider(termesDealSchema, { ...base, amount: 0 }).ok).toBe(false);
  });

  it("borne le haut : une touche restée enfoncée ne crée pas un séquestre à neuf chiffres", () => {
    expect(valider(termesDealSchema, { ...base, amount: DEAL_MONTANT_MAX + 1 }).ok).toBe(false);
    expect(valider(termesDealSchema, { ...base, amount: DEAL_MONTANT_MAX }).ok).toBe(true);
  });

  it("exige au moins un contenu", () => {
    expect(valider(termesDealSchema, { ...base, quantity: 0 }).ok).toBe(false);
    expect(valider(termesDealSchema, { ...base, quantity: 1 }).ok).toBe(true);
  });

  it("accepte une collaboration sans échéance ni brief", () => {
    const r = valider(termesDealSchema, { ...base, deadline: null, brandNotes: null });
    expect(r.ok).toBe(true);
  });

  it("refuse une date qui n'en est pas une", () => {
    expect(valider(termesDealSchema, { ...base, deadline: "bientôt" }).ok).toBe(false);
  });

  it("ne laisse pas passer un message technique à l'écran", () => {
    const r = valider(termesDealSchema, { ...base, amount: -1 });
    if (!r.ok) {
      expect(r.error).not.toContain("Expected");
      expect(r.error).not.toContain("Invalid");
    }
  });
});
