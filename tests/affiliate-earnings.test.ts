import { describe, it, expect } from "vitest";
import { countsAsEarning, sumEarnings } from "@/lib/affiliate-earnings";

/**
 * Une seule définition de « ce qui compte comme un gain », parce qu'il y en
 * avait autant que d'écrans et qu'elles divergeaient. Le tableau de bord
 * comptait les commissions rejetées tout en ignorant les actions CPA : le même
 * créateur voyait des chiffres différents selon la page.
 */
describe("ce qui compte comme un gain", () => {
  it("compte les ventes ET les actions", () => {
    expect(countsAsEarning({ type: "sale", status: "pending" })).toBe(true);
    expect(countsAsEarning({ type: "action", status: "validated" })).toBe(true);
  });

  it("ne compte pas un clic — il ne rapporte rien", () => {
    expect(countsAsEarning({ type: "click", status: null })).toBe(false);
  });

  it("écarte le rejeté et le remboursé : plus rien n'est dû", () => {
    expect(countsAsEarning({ type: "sale", status: "rejected" })).toBe(false);
    expect(countsAsEarning({ type: "action", status: "refunded" })).toBe(false);
  });

  it("compte ce qui est dû mais pas encore versé", () => {
    // `unfunded` = la marque doit encore approvisionner, mais elle DOIT.
    expect(countsAsEarning({ type: "sale", status: "unfunded" })).toBe(true);
    expect(countsAsEarning({ type: "sale", status: "paid" })).toBe(true);
  });

  it("additionne au centime, en écartant l'annulé", () => {
    expect(
      sumEarnings([
        { type: "sale", status: "validated", commission_amount: 12.5 },
        { type: "action", status: "pending", commission_amount: 7.25 },
        { type: "sale", status: "rejected", commission_amount: 1000 },
        { type: "click", status: null, commission_amount: 999 },
      ]),
    ).toBe(19.75);
  });

  it("ne se laisse pas piéger par des montants en texte", () => {
    // PostgREST renvoie les `numeric` sous forme de chaînes.
    expect(
      sumEarnings([
        { type: "sale", status: "validated", commission_amount: "10.10" as unknown as number },
        { type: "sale", status: "validated", commission_amount: "0.90" as unknown as number },
      ]),
    ).toBe(11);
  });
});
