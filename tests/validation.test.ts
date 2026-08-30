import { describe, it, expect } from "vitest";
import {
  euros,
  estAuCentime,
  montantEuros,
  identifiant,
  pourcentage,
  valider,
  nombreDuFormulaire,
} from "@/lib/validation";

/**
 * Une action serveur est appelable directement : ce que le formulaire empêche
 * n'est pas empêché côté serveur. Sans ces contrôles, un montant négatif ou un
 * pourcentage à 4 000 s'écrit en base et personne ne s'en aperçoit avant que
 * quelqu'un soit payé de travers.
 */

const UUID = "f1338eb4-a042-4fd8-aee5-ac3dd64e3151";

describe("montants", () => {
  const m = montantEuros({ quoi: "Le montant" });

  it("accepte un montant au centime", () => {
    expect(m.safeParse(49.9).success).toBe(true);
    expect(m.safeParse(0).success).toBe(true);
    expect(m.safeParse(1400).success).toBe(true);
  });

  it("refuse un montant négatif", () => {
    const r = m.safeParse(-1);
    expect(r.success).toBe(false);
    // Le message doit dire quoi faire, pas seulement que c'est faux.
    if (!r.success) expect(r.error.issues[0].message).toContain("Saisis 0 ou plus");
  });

  it("refuse plus de deux décimales", () => {
    expect(m.safeParse(49.9012).success).toBe(false);
  });

  it("laisse passer la poussière des flottants", () => {
    // 0,1 + 0,2 = 0,30000000000000004 : c'est bien 30 centimes.
    expect(estAuCentime(0.1 + 0.2)).toBe(true);
    expect(m.safeParse(0.1 + 0.2).success).toBe(true);
  });

  it("refuse un vrai millième d'euro", () => {
    expect(estAuCentime(1.234)).toBe(false);
  });

  it("refuse une saisie qui n'est pas un nombre", () => {
    expect(m.safeParse(Number.NaN).success).toBe(false);
    expect(m.safeParse("quarante" as unknown as number).success).toBe(false);
  });

  it("borne le haut pour attraper la faute de frappe", () => {
    expect(m.safeParse(9_999_999).success).toBe(false);
  });

  it("respecte une borne basse sur mesure", () => {
    const min20 = montantEuros({ quoi: "La recharge", min: 20 });
    expect(min20.safeParse(19.99).success).toBe(false);
    expect(min20.safeParse(20).success).toBe(true);
  });
});

describe("pourcentages", () => {
  it("refuse au-delà de 100 : la marque perdrait de l'argent à chaque vente", () => {
    const p = pourcentage("La commission");
    expect(p.safeParse(12).success).toBe(true);
    expect(p.safeParse(250).success).toBe(false);
    expect(p.safeParse(-5).success).toBe(false);
  });
});

describe("identifiants", () => {
  it("accepte un UUID et refuse le reste", () => {
    const id = identifiant("Cette vente");
    expect(id.safeParse(UUID).success).toBe(true);
    expect(id.safeParse("42").success).toBe(false);
    expect(id.safeParse("").success).toBe(false);
  });

  it("dit à l'utilisateur quoi faire", () => {
    const r = identifiant("Cette vente").safeParse("bidon");
    if (!r.success) expect(r.error.issues[0].message).toContain("Recharge la page");
  });
});

describe("montants en euros dans les messages", () => {
  it("écrit les montants lisiblement, sans dépendre de la machine", () => {
    // Volontairement fait à la main : `toLocaleString` produit une espace
    // fine insécable ici et une espace normale ailleurs, ce qui rendrait les
    // messages d'erreur différents selon l'environnement.
    expect(euros(20)).toBe("20 €");
    expect(euros(1400)).toBe("1 400 €");
    expect(euros(49.9)).toBe("49,90 €");
    expect(euros(1_000_000)).toBe("1 000 000 €");
  });
});

describe("lecture d'un formulaire", () => {
  it("convertit la virgule décimale française", () => {
    expect(nombreDuFormulaire("49,90")).toBe(49.9);
    expect(nombreDuFormulaire("1400")).toBe(1400);
  });

  it("rend NaN sur une saisie vide ou absurde, pour que le contrôle la rejette", () => {
    expect(Number.isNaN(nombreDuFormulaire(""))).toBe(true);
    expect(Number.isNaN(nombreDuFormulaire(null))).toBe(true);
    expect(Number.isNaN(nombreDuFormulaire("abc"))).toBe(true);
  });
});

describe("valider", () => {
  it("renvoie la première phrase compréhensible, jamais un message technique", () => {
    const r = valider(montantEuros({ quoi: "Le montant" }), -1);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toContain("Expected");
      expect(r.error).not.toContain("received");
      expect(r.error.length).toBeGreaterThan(10);
    }
  });
});

describe("saisie à la française", () => {
  it("accepte les espaces de milliers, y compris insécables", () => {
    expect(nombreDuFormulaire("1 400")).toBe(1400);
    expect(nombreDuFormulaire("1 400,50")).toBe(1400.5);
    expect(nombreDuFormulaire("1 400")).toBe(1400);
  });
});
