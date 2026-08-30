import { describe, it, expect } from "vitest";
import { fabriquerCodePromo } from "@/lib/promo-code";

/**
 * Ce code finit saisi à la main dans un panier, souvent depuis un téléphone,
 * parfois lu à voix haute dans une vidéo. Il doit être tapable — et surtout
 * attribuable : c'est lui qui décide QUI est payé.
 */
describe("code promo d'un créateur", () => {
  it("reprend le préfixe de la marque et le nom du créateur", () => {
    const c = fabriquerCodePromo("maison", "juliendrn");
    expect(c).toMatch(/^MAISON-JULIENDRN-[A-Z0-9]{2}$/);
  });

  it("se passe de préfixe quand la marque n'en a pas mis", () => {
    expect(fabriquerCodePromo(null, "juliendrn")).toMatch(/^JULIENDRN-[A-Z0-9]{2}$/);
  });

  it("retire accents et ponctuation — le code se tape sur un clavier", () => {
    expect(fabriquerCodePromo("Été", "léa.martin")).toMatch(/^ETE-LEAMARTIN-[A-Z0-9]{2}$/);
  });

  it("n'utilise aucun caractère qu'on confond à l'oral ou à l'écrit", () => {
    // Ni O/0, ni I/1/L : « c'est un zéro ou un O ? » coûte une vente.
    for (let i = 0; i < 200; i++) {
      const suffixe = fabriquerCodePromo(null, "test").split("-").pop()!;
      expect(suffixe).not.toMatch(/[O0I1L]/);
    }
  });

  it("allonge le suffixe à chaque collision", () => {
    expect(fabriquerCodePromo(null, "test", 0).split("-").pop()).toHaveLength(2);
    expect(fabriquerCodePromo(null, "test", 2).split("-").pop()).toHaveLength(4);
  });

  it("tient debout quand le créateur n'a pas encore d'identifiant", () => {
    expect(fabriquerCodePromo("maison", null)).toMatch(/^MAISON-CREATEUR-[A-Z0-9]{2}$/);
  });
});
