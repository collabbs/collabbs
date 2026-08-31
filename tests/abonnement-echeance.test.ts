import { describe, it, expect } from "vitest";
import { planValide, tauxCollab, TARIFS } from "@/lib/tarifs";
import { identifiantAbonnement } from "@/lib/abonnement-stripe";

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

describe("identifiantAbonnement", () => {
  // `invoice.subscription` a disparu du premier niveau dans l'API Stripe
  // actuelle. Le code ne lisait que l'ancien champ : `invoice.paid` ne trouvait
  // plus rien et sortait en silence, le webhook répondait 200, et l'échéance ne
  // reculait jamais. La marque payait 99 € par mois pour retomber au tarif
  // gratuit dès le deuxième.
  it("lit la forme ACTUELLE de Stripe", () => {
    expect(
      identifiantAbonnement({
        parent: { subscription_details: { subscription: "sub_123" } },
      }),
    ).toBe("sub_123");
  });

  it("lit encore l'ancienne forme", () => {
    expect(identifiantAbonnement({ subscription: "sub_456" })).toBe("sub_456");
    expect(identifiantAbonnement({ subscription: { id: "sub_789" } })).toBe("sub_789");
  });

  it("rend null quand il n'y a vraiment rien", () => {
    expect(identifiantAbonnement({})).toBeNull();
    expect(identifiantAbonnement({ subscription: null, parent: null })).toBeNull();
    // Une chaîne vide n'est pas un identifiant.
    expect(identifiantAbonnement({ subscription: "" })).toBeNull();
  });
});
