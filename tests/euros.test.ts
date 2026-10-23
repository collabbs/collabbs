import { describe, expect, it } from "vitest";
import { montant, tarif } from "@/lib/euros";

/**
 * L'écriture de l'argent.
 *
 * Le produit en avait huit versions différentes, dont deux se croisaient sur
 * un même écran — `/payouts` affichait « 32€ » pour l'argent des
 * collaborations et « 32,00€ » pour celui de l'affiliation, la même somme due
 * à la même personne. L'inventaire complet est dans `lib/euros.ts`.
 *
 * Les espaces attendues ici sont INSÉCABLES (U+00A0), écrites en clair : une
 * espace ordinaire autoriserait « 1 » en fin de ligne et « 400,00 € » au
 * début de la suivante, et `toLocaleString` en choisit une différente selon
 * les données de langue de la machine.
 */
const NB = " ";

describe("montant — argent dû, détenu ou versé", () => {
  it("écrit toujours les centimes", () => {
    expect(montant(32)).toBe(`32,00${NB}€`);
    expect(montant(0)).toBe(`0,00${NB}€`);
    expect(montant(49.9)).toBe(`49,90${NB}€`);
    expect(montant(7.2)).toBe(`7,20${NB}€`);
  });

  it("groupe les milliers", () => {
    expect(montant(1400.5)).toBe(`1${NB}400,50${NB}€`);
    expect(montant(1_000_000)).toBe(`1${NB}000${NB}000,00${NB}€`);
  });

  it("absorbe la poussière binaire", () => {
    // 0,1 + 0,2 vaut 0,30000000000000004 en flottant : ça doit passer.
    expect(montant(0.1 + 0.2)).toBe(`0,30${NB}€`);
  });

  it("ne peut pas inventer un centime qu'un double ne porte pas", () => {
    /* 2,675 n'est pas representable : le double le plus proche vaut
       2,67499999999999982236431605997495353221893310546875. Il n'y a donc
       rien à arrondir vers le haut, et aucun formateur n'y changera quoi que
       ce soit. C'est pour ça que les montants sont passés par `round2` AVANT
       d'arriver ici : la multiplication par 100 retombe sur 267,5 exactement
       — l'erreur de 1,8 × 10⁻¹⁶ disparaît dans l'arrondi du produit — et
       `Math.round(267.5)` donne 268, donc 2,68.
       Le test est là pour que personne ne « corrige » le formatage en croyant
       à un défaut, alors que la règle est : arrondir avant d'écrire. */
    expect(montant(2.675)).toBe(`2,67${NB}€`);
    expect(montant(Math.round(2.675 * 100) / 100)).toBe(`2,68${NB}€`);
  });

  it("porte le signe devant, pas devant les milliers", () => {
    expect(montant(-12.3)).toBe(`-12,30${NB}€`);
    expect(montant(-1400)).toBe(`-1${NB}400,00${NB}€`);
  });
});

describe("tarif — prix, estimation, seuil", () => {
  it("omet les centimes quand ils sont nuls", () => {
    expect(tarif(300)).toBe(`300${NB}€`);
    expect(tarif(20)).toBe(`20${NB}€`);
    expect(tarif(1_000_000)).toBe(`1${NB}000${NB}000${NB}€`);
  });

  it("les garde quand ils existent", () => {
    expect(tarif(49.9)).toBe(`49,90${NB}€`);
    expect(tarif(1400.5)).toBe(`1${NB}400,50${NB}€`);
  });

  it("porte le signe devant", () => {
    expect(tarif(-300)).toBe(`-300${NB}€`);
  });
});

describe("une seule façon d'écrire l'argent", () => {
  it("les espaces sont insécables, jamais ordinaires ni fines", () => {
    for (const sortie of [montant(5), tarif(5), montant(1234.56), tarif(1234567)]) {
      expect(sortie.endsWith(`${NB}€`), sortie).toBe(true);
      // U+202F dépend des données de langue et n'existe pas dans l'encodage
      // WinAnsi du PDF du contrat.
      expect(sortie).not.toContain(" ");
      // Une espace ordinaire autoriserait la coupure du montant.
      expect(sortie).not.toContain(" ");
    }
  });

  it("les deux fonctions s'accordent dès qu'il y a des centimes", () => {
    expect(tarif(67.36)).toBe(montant(67.36));
  });
});
