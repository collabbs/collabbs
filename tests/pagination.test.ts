import { describe, expect, it } from "vitest";
import { decouper } from "@/components/Pagination";

/**
 * Ce qui compte ici n'est pas la division — c'est ce qui arrive quand le
 * numéro de page ne vient pas d'un clic. Une URL se tape, se partage, vieillit
 * et se fait essayer par des robots : aucun de ces cas ne doit afficher
 * « aucun résultat » alors qu'il y en a.
 */
describe("decouper", () => {
  const cent = Array.from({ length: 100 }, (_, i) => i + 1);

  it("découpe et dit où on en est", () => {
    const r = decouper(cent, "2", 24);
    expect(r.page).toBe(2);
    expect(r.pages).toBe(5);
    expect(r.lignes).toEqual(Array.from({ length: 24 }, (_, i) => i + 25));
    expect(r.premier).toBe(25);
    expect(r.dernier).toBe(48);
  });

  it("sans numéro, on est page 1", () => {
    expect(decouper(cent, undefined, 24).page).toBe(1);
  });

  it("la dernière page est partielle, pas vide", () => {
    const r = decouper(cent, "5", 24);
    expect(r.lignes).toHaveLength(4);
    expect(r.premier).toBe(97);
    expect(r.dernier).toBe(100);
  });

  it("un numéro trop grand ramène à la dernière page, pas à du vide", () => {
    const r = decouper(cent, "99999", 24);
    expect(r.page).toBe(5);
    expect(r.lignes).toHaveLength(4);
  });

  it("zéro, négatif et texte ramènent à la page 1", () => {
    for (const mauvais of ["0", "-3", "abc", "", "2.7.1", "NaN"]) {
      const r = decouper(cent, mauvais, 24);
      expect(r.page, `page=${mauvais}`).toBe(1);
      expect(r.lignes[0], `page=${mauvais}`).toBe(1);
    }
  });

  it("une liste vide fait une page, et n'annonce pas « 1–0 »", () => {
    const r = decouper([], "3", 24);
    expect(r.pages).toBe(1);
    expect(r.page).toBe(1);
    expect(r.lignes).toEqual([]);
    expect(r.premier).toBe(0);
    expect(r.dernier).toBe(0);
  });

  it("une liste plus courte qu'une page ne se pagine pas", () => {
    const r = decouper([1, 2, 3], undefined, 24);
    expect(r.pages).toBe(1);
    expect(r.dernier).toBe(3);
  });

  it("un multiple exact ne crée pas de page vide à la fin", () => {
    expect(decouper(Array.from({ length: 48 }), "1", 24).pages).toBe(2);
  });
});
