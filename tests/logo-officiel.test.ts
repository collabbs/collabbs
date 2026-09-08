import { describe, expect, it } from "vitest";
import { logoActuel, nomDeDomaine, renduCommons, type Revendication } from "@/lib/logo-officiel";

const claim = (fichier: string, rank = "normal", finie = false): Revendication => ({
  rank,
  mainsnak: { datavalue: { value: fichier } },
  qualifiers: finie ? { P582: [{}] } : {},
});

describe("nomDeDomaine", () => {
  it("garde le nom, pas l'extension", () => {
    expect(nomDeDomaine("www.decathlon.fr")).toBe("decathlon");
    expect(nomDeDomaine("decathlon.com")).toBe("decathlon");
    // Le site officiel d'une fiche est souvent le .com alors que la marque
    // nous donne son .fr : comparer le nom seul les réconcilie.
    expect(nomDeDomaine("www.decathlon.fr")).toBe(nomDeDomaine("decathlon.com"));
  });

  it("ne se laisse pas prendre par un sous-domaine", () => {
    expect(nomDeDomaine("boutique.sephora.fr")).toBe("sephora");
  });
});

describe("logoActuel", () => {
  it("écarte les logos historiques", () => {
    // Le cas réel qui a servi d'alerte : la fiche Decathlon porte trois logos,
    // dont celui de 1976. Sans cette règle, c'est lui qui s'affichait.
    expect(
      logoActuel([
        claim("Decathlon 1976.svg", "normal", true),
        claim("Decathlon 1990.svg", "normal", true),
        claim("Decathlon 2024.svg", "preferred"),
      ]),
    ).toBe("Decathlon 2024.svg");
  });

  it("suit le rang préféré même sans date de fin ailleurs", () => {
    expect(logoActuel([claim("Ancien.svg"), claim("Actuel.svg", "preferred")])).toBe("Actuel.svg");
  });

  it("prend celui qui n'est pas terminé quand aucun rang ne tranche", () => {
    expect(logoActuel([claim("Fini.svg", "normal", true), claim("En cours.svg")])).toBe(
      "En cours.svg",
    );
  });

  it("ne renvoie rien plutôt qu'un logo douteux", () => {
    expect(logoActuel([])).toBeNull();
    expect(logoActuel([{ rank: "normal", mainsnak: {} }])).toBeNull();
  });
});

describe("renduCommons", () => {
  it("échappe les noms de fichiers, espaces et parenthèses compris", () => {
    const u = renduCommons("Decathlon - logo (France, 2024).svg", 512);
    expect(u).toContain("Special:FilePath/");
    expect(u).toContain("width=512");
    expect(u).not.toContain(" ");
  });
});
