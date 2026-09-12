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
    expect(source).toMatch(/if \(reserved\) \{[\s\S]{0,900}?after\(\(\) => rechargerSiSousLeSeuil\(brandId\)\)/);
  });

  it("survit à l'envoi de la réponse", () => {
    /* Ma première version lançait la recharge sans l'attendre — `void` — pour
       ne pas retarder la réponse à la boutique. Sur une fonction sans serveur,
       une promesse non attendue est TUÉE dès que la réponse part : la recharge
       ne s'exécutait jamais. Vérifié en conditions réelles.
       `after()` fait exactement ce qu'on voulait : le travail s'exécute après
       l'envoi de la réponse, et la plateforme garde la fonction en vie. */
    expect(source).toContain("after(() => rechargerSiSousLeSeuil(brandId))");
    expect(source).not.toMatch(/void rechargerSiSousLeSeuil/);
  });

  it("ne retente pas une carte déjà refusée", () => {
    // Sinon on accumule les refus chez Stripe à chaque vente, ce qui finit par
    // faire blacklister le moyen de paiement.
    expect(source).toMatch(/if \(b\.topup_failed_at\) return;/);
  });
});
