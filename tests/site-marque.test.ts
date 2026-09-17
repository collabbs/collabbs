import { describe, it, expect } from "vitest";
import { normaliserSiteMarque } from "@/lib/site-marque";

/**
 * Trouvé en préparant la boutique de test : le site déclaré par une marque de
 * production était une page atteinte par une publicité Google, paramètres
 * compris. Personne ne l'avait remarqué, parce que rien ne casse — la fiche
 * publique renvoie simplement vers une adresse que la marque ne reconnaît pas.
 */
describe("l'adresse du site d'une marque", () => {
  it("jette les paramètres publicitaires collés depuis la barre d'adresse", () => {
    expect(
      normaliserSiteMarque(
        "https://www.exemple.fr/fr/?utm_source=google&gclid=Cj0KCQjwh4TV&gad_source=1",
      ),
    ).toBe("https://www.exemple.fr/fr");
  });

  it("jette l'ancre, qui décrit une position dans une page", () => {
    expect(normaliserSiteMarque("https://exemple.fr/produits#avis")).toBe(
      "https://exemple.fr/produits",
    );
  });

  it("garde le chemin, qui peut être la vraie page de la marque", () => {
    expect(normaliserSiteMarque("https://exemple.fr/boutique/serum")).toBe(
      "https://exemple.fr/boutique/serum",
    );
  });

  it("ajoute le schéma quand la marque ne l'a pas tapé", () => {
    expect(normaliserSiteMarque("exemple.fr")).toBe("https://exemple.fr");
    expect(normaliserSiteMarque("  www.exemple.fr  ")).toBe("https://www.exemple.fr");
  });

  it("impose https, même si la marque a collé du http", () => {
    // Une boutique en clair ne prendra aucun paiement, et le tracker y serait
    // bloqué par le navigateur.
    expect(normaliserSiteMarque("http://exemple.fr")).toBe("https://exemple.fr");
  });

  it("refuse ce qui n'est pas un domaine public", () => {
    // Sans ce refus, la vérification d'installation irait interroger une
    // machine interne au nom de la marque.
    for (const saisie of ["localhost", "", "   ", "http://", "mon site"]) {
      expect(normaliserSiteMarque(saisie)).toBeNull();
    }
  });

  it("une barre finale ne crée pas deux adresses différentes", () => {
    expect(normaliserSiteMarque("https://exemple.fr/")).toBe(
      normaliserSiteMarque("https://exemple.fr"),
    );
  });
});
