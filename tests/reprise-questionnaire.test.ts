import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { CLE_BRIEF, CLE_CARTE } from "@/lib/quiz";

/**
 * Le pont entre le questionnaire (avant compte) et le produit (après compte).
 *
 * ─── Le défaut que ce fichier existe pour empêcher ───
 * Il y a deux questionnaires, donc deux tiroirs : la MARQUE range son brief
 * sous `collabbs.brief.v1`, le CRÉATEUR sa carte sous `collabbs.carte.v1`.
 * La reprise côté marque lisait le tiroir du créateur. Rien ne plantait :
 * une marque remplissait cinq étapes, créait son compte, arrivait sur ses
 * campagnes — vides, sans un mot d'explication. Le pont était construit et
 * ne raccordait rien.
 *
 * Aucun test unitaire ne pouvait l'attraper : les deux clés sont des chaînes
 * valides, et le code marchait parfaitement — sur le mauvais tiroir. On vérifie
 * donc la seule chose qui compte ici, QUELLE clé chaque reprise ouvre.
 */

function source(chemin: string) {
  return readFileSync(new URL(`../src/${chemin}`, import.meta.url), "utf8");
}

describe("chaque reprise ouvre le tiroir de son côté", () => {
  it("les deux tiroirs sont bien distincts", () => {
    expect(CLE_BRIEF).not.toBe(CLE_CARTE);
  });

  it("la reprise MARQUE lit le brief, jamais la carte du créateur", () => {
    const s = source("app/(app)/campaigns/ReprendreQuestionnaire.tsx");
    expect(s).toContain("getItem(CLE_BRIEF)");
    expect(s).not.toMatch(/getItem\(CLE_CARTE\)/);
  });

  it("le questionnaire MARQUE écrit dans ce même tiroir", () => {
    // L'écriture passe par `useStockageLocal(clé, …)`, pas par un setItem nu.
    const s = source("app/commencer/QuizMarque.tsx");
    expect(s).toMatch(/useStockageLocal<CarteMarque>\(\s*CLE_BRIEF/);
  });

  it("la reprise CRÉATEUR lit la carte", () => {
    const s = source("app/(app)/RepriseDuDefile.tsx");
    expect(s).toContain("CLE_CARTE");
  });
});
