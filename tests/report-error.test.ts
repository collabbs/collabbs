import { describe, it, expect } from "vitest";
import { normalizeMessage } from "@/lib/report-error";

/**
 * Le regroupement des erreurs repose sur ce nettoyage : sans lui, une même
 * panne survenue mille fois crée mille lignes distinctes (chacune portant un
 * identifiant différent) et l'écran d'administration devient illisible — donc
 * inutile, donc jamais consulté.
 */
describe("regroupement des erreurs", () => {
  it("gomme les identifiants pour regrouper une même panne", () => {
    const a = normalizeMessage(
      "versement impossible sur f1338eb4-a042-4fd8-aee5-ac3dd64e3151",
    );
    const b = normalizeMessage(
      "versement impossible sur 28a39e9b-483e-42a3-9637-93934e97f133",
    );
    expect(a).toBe(b);
    expect(a).toContain("<id>");
  });

  it("gomme les références Stripe", () => {
    expect(normalizeMessage("No such payment_intent: 'pi_3ABCdefGHI'")).toBe(
      normalizeMessage("No such payment_intent: 'pi_9ZYXwvuTSR'"),
    );
  });

  it("gomme les montants et les dates", () => {
    expect(normalizeMessage("provision insuffisante : 1 400,00 €")).toBe(
      normalizeMessage("provision insuffisante : 25,50 €"),
    );
    expect(normalizeMessage("expiré le 2026-08-30T12:00:00Z")).toContain("<date>");
  });

  it("ne confond pas deux pannes différentes", () => {
    expect(normalizeMessage("versement impossible")).not.toBe(
      normalizeMessage("séquestre introuvable"),
    );
  });

  it("borne la longueur pour ne pas gonfler la table", () => {
    expect(normalizeMessage("x".repeat(900)).length).toBe(500);
  });
});
