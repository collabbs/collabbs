import { describe, it, expect } from "vitest";
import { planValide, tauxCollab, TARIFS } from "@/lib/tarifs";
import { identifiantAbonnement, finDePeriode } from "@/lib/abonnement-stripe";

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

describe("finDePeriode", () => {
  // Le champ a migré de la racine vers `items.data[]`. Se tromper de place ne
  // lève aucune erreur : on obtient `undefined`, donc « pas d'échéance », donc
  // un abonnement sans terme — ou une résiliation qui ne sait pas dire quand
  // elle prend effet.
  const LE_1ER_MARS = "2026-03-01T00:00:00.000Z";
  const horodatage = Math.floor(new Date(LE_1ER_MARS).getTime() / 1000);

  it("lit l'ancienne forme, à la racine", () => {
    expect(finDePeriode({ current_period_end: horodatage })).toBe(LE_1ER_MARS);
  });

  it("lit la forme actuelle, dans les lignes de l'abonnement", () => {
    expect(
      finDePeriode({ items: { data: [{ current_period_end: horodatage }] } }),
    ).toBe(LE_1ER_MARS);
  });

  it("la racine l'emporte quand les deux sont là", () => {
    expect(
      finDePeriode({
        current_period_end: horodatage,
        items: { data: [{ current_period_end: horodatage + 86400 }] } ,
      }),
    ).toBe(LE_1ER_MARS);
  });

  it("renvoie null plutôt qu'une date inventée", () => {
    // Une date fausse ferait rétrograder une marque qui paie, ou l'inverse.
    for (const sub of [{}, { current_period_end: null }, { items: null }, { items: { data: [] } }]) {
      expect(finDePeriode(sub)).toBeNull();
    }
  });
});
