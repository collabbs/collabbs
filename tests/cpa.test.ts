import { describe, it, expect } from "vitest";
import { cpaTotalFor, cpaIncrement, cpaTierLabel, pluralizeAction } from "@/lib/cpa";

/**
 * Le CPA n'était pas suivi du tout : une marque pouvait publier « 2 € par
 * inscription » et le créateur ne jamais être payé. Ces tests figent le calcul
 * au moment où on l'implémente, parce qu'il décide de vrais versements.
 */

const flat = { type: "cpa_flat", cpa_value_per_action: 2 };
const paliers = { type: "cpa_tiers", cpa_value_per_action: null };
const TIERS = [
  { min_actions: 100, payout: 10, label: "Bronze" },
  { min_actions: 500, payout: 60, label: "Argent" },
  { min_actions: 1000, payout: 150, label: "Or" },
];

describe("paiement par action (cpa_flat)", () => {
  it("multiplie simplement le nombre d'actions", () => {
    expect(cpaTotalFor(flat, [], 1)).toBe(2);
    expect(cpaTotalFor(flat, [], 37)).toBe(74);
  });

  it("compte les centimes, jamais arrondis à l'euro", () => {
    const demi = { type: "cpa_flat", cpa_value_per_action: 0.5 };
    expect(cpaTotalFor(demi, [], 3)).toBe(1.5);
    const virgule = { type: "cpa_flat", cpa_value_per_action: 1.35 };
    expect(cpaTotalFor(virgule, [], 7)).toBe(9.45);
  });

  it("ne paie rien si la campagne n'est pas configurée", () => {
    expect(cpaTotalFor({ type: "cpa_flat", cpa_value_per_action: null }, [], 50)).toBe(0);
    expect(cpaTotalFor({ type: "cpa_flat", cpa_value_per_action: 0 }, [], 50)).toBe(0);
  });
});

describe("paliers (cpa_tiers)", () => {
  it("paie le montant du palier le plus élevé franchi, pas la somme", () => {
    expect(cpaTotalFor(paliers, TIERS, 99)).toBe(0);   // aucun palier
    expect(cpaTotalFor(paliers, TIERS, 100)).toBe(10);  // Bronze pile
    expect(cpaTotalFor(paliers, TIERS, 499)).toBe(10);
    expect(cpaTotalFor(paliers, TIERS, 500)).toBe(60);  // Argent REMPLACE Bronze
    expect(cpaTotalFor(paliers, TIERS, 5000)).toBe(150); // plafonné à Or
  });

  it("ne dépend pas de l'ordre des paliers en base", () => {
    const melange = [TIERS[2], TIERS[0], TIERS[1]];
    expect(cpaTotalFor(paliers, melange, 600)).toBe(60);
  });

  it("nomme le palier atteint", () => {
    expect(cpaTierLabel(TIERS, 50)).toBe(null);
    expect(cpaTierLabel(TIERS, 500)).toBe("Argent");
    expect(cpaTierLabel(TIERS, 1200)).toBe("Or");
  });
});

describe("ce qui reste à créditer", () => {
  it("n'ajoute que la différence quand un palier est franchi", () => {
    // Le créateur avait Bronze (10 €), il atteint Argent (60 €).
    expect(cpaIncrement(paliers, TIERS, 500, 10)).toBe(50);
  });

  it("ne crédite rien pour des actions sans nouveau palier", () => {
    // 400 actions de plus, toujours dans Bronze : c'est ce que l'interface
    // annonce, il ne faut pas inventer une rémunération.
    expect(cpaIncrement(paliers, TIERS, 499, 10)).toBe(0);
  });

  it("ne reprend jamais ce qui a déjà été crédité", () => {
    // Actions annulées, palier retiré : l'écart négatif ne devient pas une
    // reprise silencieuse sur le créateur.
    expect(cpaIncrement(paliers, TIERS, 100, 60)).toBe(0);
  });

  it("un postback rejoué ne paie pas deux fois", () => {
    // Même cumul, même crédit : rien de plus.
    expect(cpaIncrement(flat, [], 10, 20)).toBe(0);
  });

  it("rattrape un retard de crédit sans état intermédiaire", () => {
    // 10 actions à 2 €, rien encore crédité : on rattrape tout d'un coup.
    expect(cpaIncrement(flat, [], 10, 0)).toBe(20);
  });
});

describe("pluriel des libellés d'action", () => {
  it("laisse le singulier au singulier", () => {
    expect(pluralizeAction("inscription", 1)).toBe("inscription");
    expect(pluralizeAction("inscription", 0)).toBe("inscription");
  });

  it("applique la règle ordinaire", () => {
    expect(pluralizeAction("inscription", 2)).toBe("inscriptions");
    // Une locution reste intacte : « essai gratuits » serait une faute, et on
    // ne sait pas accorder « devis en ligne » sans se tromper.
    expect(pluralizeAction("essai gratuit", 50)).toBe("essai gratuit");
    expect(pluralizeAction("devis en ligne", 50)).toBe("devis en ligne");
  });

  it("laisse invariables les mots déjà terminés par s, x ou z", () => {
    expect(pluralizeAction("devis", 10)).toBe("devis");
    expect(pluralizeAction("choix", 10)).toBe("choix");
    expect(pluralizeAction("inscriptions", 10)).toBe("inscriptions");
  });

  it("gère les pluriels irréguliers courants", () => {
    expect(pluralizeAction("jeu", 3)).toBe("jeux");
    expect(pluralizeAction("signal", 3)).toBe("signaux");
  });
});
