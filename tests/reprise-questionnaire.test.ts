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

/**
 * Le rappel du défilé ne doit écrire à personne d'injoignable.
 *
 * ─── Deux erreurs successives sur la même garde ───
 * 1. Elle lisait `listUsers()` sans regarder l'erreur. Or cet appel échoue en
 *    entier dès qu'UNE ligne d'authentification est corrompue : la table
 *    d'adresses restait vide et le rappel n'envoyait rien, en silence.
 * 2. Elle devinait les comptes de démonstration à la forme de leur adresse —
 *    « @collabbs.test » et « +demo » — alors qu'ils s'appellent
 *    `demo+lea@collabbs.dev`. Le plus est AVANT, le domaine n'est pas celui-là.
 *    Aucun des vingt-quatre n'était écarté, et `collabbs.dev` n'a pas de MX :
 *    vingt-quatre rebonds durs, exactement ce que la garde prétendait empêcher.
 *
 * D'où ce test : la vérité est dans `creators.is_demo`, pas dans une chaîne de
 * caractères. Le filet sur les domaines morts ne vient qu'APRÈS, et il doit
 * reconnaître les adresses réelles du jeu de démonstration.
 */
describe("à qui le rappel du défilé a le droit d'écrire", () => {
  const source = readFileSync(
    new URL("../src/app/api/cron/rappel-defile/route.ts", import.meta.url),
    "utf8",
  );

  it("sélectionne les créateurs par is_demo, pas par leur adresse", () => {
    expect(source).toMatch(/from\("creators"\)[\s\S]{0,80}\.eq\("is_demo", false\)/);
  });

  it("regarde l'erreur de listUsers au lieu de la traverser", () => {
    expect(source).toMatch(/error: errComptes/);
    expect(source).toMatch(/if \(errComptes\)/);
  });

  it("le filet de sécurité couvre les domaines réellement utilisés en démo", () => {
    // `collabbs.dev` est celui qui manquait — c'est le vrai domaine des 24.
    for (const d of ["@collabbs.dev", "@collabbs.test", "@example.com"]) {
      expect(source).toContain(d);
    }
  });
});
