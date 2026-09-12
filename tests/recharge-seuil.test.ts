import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Le seuil de recharge doit décider de quelque chose.
 *
 * ─── Ce qui était promis, et ce qui se passait ───
 * L'écran de provision dit : « Quand le solde passe sous le seuil, on recharge
 * ta carte automatiquement. Tes campagnes ne s'arrêtent jamais », et propose un
 * champ « Recharger sous X € ».
 *
 * Ce seuil n'était lu que pour être réaffiché. La recharge ne partait qu'au
 * moment où une réservation ÉCHOUAIT — c'est-à-dire quand la provision était
 * déjà à sec. Une marque qui choisissait 60 € croyait se donner une marge ;
 * la recharge, elle, attendait 0 €.
 *
 * Le résultat final était souvent le même, mais pas le risque : si la carte
 * est refusée à ce moment-là, la commission reste non financée et le créateur
 * attend. Tout l'intérêt d'un seuil est de recharger AVANT d'en avoir besoin.
 */
const source = readFileSync(
  new URL("../src/lib/affiliate-billing.ts", import.meta.url),
  "utf8",
);

describe("le seuil de recharge automatique", () => {
  it("est comparé au solde, pas seulement réaffiché", () => {
    expect(source).toMatch(/const seuil = Number\(b\.autotopup_threshold/);
    expect(source).toMatch(/if \(Number\(b\.balance \?\? 0\) >= seuil\) return;/);
  });

  it("se déclenche après une réservation réussie", () => {
    expect(source).toMatch(/if \(reserved\) \{\s*\n\s*void rechargerSiSousLeSeuil\(brandId\);/);
  });

  it("ne retarde pas la réponse au postback de la marque", () => {
    // `void` et non `await` : la boutique attend un accusé de réception, pas
    // le temps d'un débit de carte.
    expect(source).toContain("void rechargerSiSousLeSeuil(brandId)");
  });

  it("ne retente pas une carte déjà refusée", () => {
    // Sinon on accumule les refus chez Stripe à chaque vente, ce qui finit par
    // faire blacklister le moyen de paiement.
    expect(source).toMatch(/if \(b\.topup_failed_at\) return;/);
  });
});
