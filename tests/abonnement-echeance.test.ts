import { describe, it, expect } from "vitest";
import { planValide, tauxCollab, TARIFS } from "@/lib/tarifs";

/**
 * La règle qui décide du taux appliqué. On la teste sur la partie pure —
 * `planDeLaMarque` ajoute la lecture en base et l'échéance par-dessus.
 */
function planEffectif(plan: string | null, echeance: string | null, maintenant = Date.now()) {
  const echu = echeance != null && new Date(echeance).getTime() < maintenant;
  return echu ? "free" : planValide(plan);
}

describe("plan appliqué à une marque", () => {
  it("un abonnement échu retombe au tarif gratuit", () => {
    // Le webhook Stripe peut manquer, le cron peut avoir du retard : la
    // lecture doit être juste sans dépendre d'eux.
    expect(planEffectif("growth", "2020-01-01T00:00:00Z")).toBe("free");
    expect(tauxCollab(planEffectif("scale", "2020-01-01T00:00:00Z"))).toBe(
      TARIFS.free.tauxCollab,
    );
  });

  it("un abonnement en cours applique bien son taux", () => {
    const dansUnMois = new Date(Date.now() + 30 * 86400000).toISOString();
    expect(planEffectif("growth", dansUnMois)).toBe("growth");
    expect(tauxCollab(planEffectif("growth", dansUnMois))).toBe(TARIFS.growth.tauxCollab);
  });

  it("sans échéance, le plan vaut tel quel", () => {
    expect(planEffectif("scale", null)).toBe("scale");
  });

  it("aucune valeur douteuse ne donne un tarif avantageux", () => {
    for (const p of [null, "", "premium", "GROWTH"]) {
      expect(planEffectif(p, null)).toBe("free");
    }
  });
});
