import { describe, expect, it } from "vitest";
import { objetDuMontant } from "@/lib/collaboration";

/**
 * « 300 € par créateur » ne veut rien dire : par créateur pour une vidéo ? une
 * story ? Un créateur ne peut pas juger s'il est bien paye sans savoir ce
 * qu'on lui demande — et c'est la decision qu'on lui demande de prendre en une
 * seconde.
 */
describe("objetDuMontant", () => {
  it("dit ce que le forfait achète", () => {
    expect(objetDuMontant("video")).toBe("pour une vidéo postée");
    expect(objetDuMontant("ugc")).toBe("pour du contenu UGC");
    expect(objetDuMontant("hybrid")).toBe("par vidéo");
  });

  it("garde un repli honnête pour un type inconnu", () => {
    // Mieux vaut « par créateur », vague mais vrai, qu'une affirmation
    // inventée sur ce que la marque attend.
    expect(objetDuMontant("type_inconnu")).toBe("par créateur");
    expect(objetDuMontant("")).toBe("par créateur");
  });
});
