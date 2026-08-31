import { describe, it, expect } from "vitest";
import {
  fenetreValide,
  horsFenetre,
  motifHorsFenetre,
  FENETRE_PAR_DEFAUT,
} from "@/lib/attribution";

const jour = (n: number) => new Date(Date.UTC(2026, 0, n)).toISOString();

describe("fenêtre valable", () => {
  it("retombe sur la valeur par défaut plutôt que sur zéro", () => {
    // Une fenêtre à zéro rejetterait toutes les ventes : c'est le seul
    // résultat que cette fonction ne doit jamais produire.
    expect(fenetreValide(null)).toBe(FENETRE_PAR_DEFAUT);
    expect(fenetreValide(undefined)).toBe(FENETRE_PAR_DEFAUT);
    expect(fenetreValide(0)).toBe(FENETRE_PAR_DEFAUT);
    expect(fenetreValide(-5)).toBe(FENETRE_PAR_DEFAUT);
    expect(fenetreValide(NaN)).toBe(FENETRE_PAR_DEFAUT);
  });

  it("refuse ce que la contrainte en base refuserait", () => {
    expect(fenetreValide(366)).toBe(FENETRE_PAR_DEFAUT);
    expect(fenetreValide(365)).toBe(365);
    expect(fenetreValide(1)).toBe(1);
  });

  it("accepte une fenêtre légitime", () => {
    expect(fenetreValide(90)).toBe(90);
  });
});

describe("dedans ou dehors", () => {
  it("une vente dans la fenêtre reste attribuée", () => {
    expect(horsFenetre(jour(1), jour(20), 30)).toBe(false);
  });

  it("le jour de la limite reste attribué", () => {
    expect(horsFenetre(jour(1), jour(31), 30)).toBe(false);
  });

  it("le jour suivant ne l'est plus", () => {
    expect(horsFenetre(jour(1), jour(32), 30)).toBe(true);
  });

  it("une fenêtre allongée rattrape une vente tardive", () => {
    expect(horsFenetre(jour(1), jour(60), 30)).toBe(true);
    expect(horsFenetre(jour(1), jour(60), 90)).toBe(false);
  });
});

describe("le doute ne joue jamais contre le créateur", () => {
  it("sans date de clic, la vente est attribuée", () => {
    expect(horsFenetre(null, jour(1), 30)).toBe(false);
    expect(horsFenetre(undefined, jour(1), 30)).toBe(false);
    expect(horsFenetre("", jour(1), 30)).toBe(false);
  });

  it("une date illisible ne coûte pas la commission", () => {
    expect(horsFenetre("hier matin", jour(1), 30)).toBe(false);
  });

  it("une horloge de navigateur en avance ne coûte pas la commission", () => {
    // Clic « après » la vente : impossible, donc c'est l'horloge qui ment.
    expect(horsFenetre(jour(20), jour(1), 30)).toBe(false);
  });

  it("une fenêtre aberrante retombe sur la valeur par défaut, pas sur un rejet", () => {
    expect(horsFenetre(jour(1), jour(20), 0)).toBe(false);
  });
});

describe("motif affiché à la marque", () => {
  it("dit l'écart réel et la fenêtre appliquée", () => {
    expect(motifHorsFenetre(jour(1), jour(45), 30)).toBe(
      "Vente 44 jours après le clic, au-delà de la fenêtre d'attribution de 30 jours.",
    );
  });
});
