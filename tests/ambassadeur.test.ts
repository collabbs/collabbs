import { describe, it, expect } from "vitest";
import {
  ajouterMois,
  prochaineEcheance,
  moisRestants,
  doitOuvrirLeMois,
  coutTotal,
  libelleEngagement,
  finDuPreavis,
} from "@/lib/ambassadeur";

const jour = (iso: string) => iso.slice(0, 10);

describe("ajouterMois", () => {
  it("avance d'un mois normalement", () => {
    expect(jour(ajouterMois("2026-03-15T12:00:00Z", 1))).toBe("2026-04-15");
    expect(jour(ajouterMois("2026-01-10T12:00:00Z", 6))).toBe("2026-07-10");
  });

  it("ne déborde PAS sur le mois suivant depuis un 31", () => {
    // `new Date(2026, 0, 31)` + 1 mois donne le 3 mars en JavaScript : le
    // 31 février n'existe pas et l'objet Date déborde en silence. Sur un
    // planificateur de paiements, ce débordement décale une échéance entière.
    expect(jour(ajouterMois("2026-01-31T12:00:00Z", 1))).toBe("2026-02-28");
    expect(jour(ajouterMois("2026-05-31T12:00:00Z", 1))).toBe("2026-06-30");
  });

  it("gère l'année bissextile", () => {
    // 2028 est bissextile : le 29 février existe.
    expect(jour(ajouterMois("2028-01-31T12:00:00Z", 1))).toBe("2028-02-29");
  });

  it("passe l'année", () => {
    expect(jour(ajouterMois("2026-11-15T12:00:00Z", 3))).toBe("2027-02-15");
  });
});

describe("prochaineEcheance", () => {
  it("part du nombre de mois DÉJÀ ouverts, pas de la date du jour", () => {
    // Un automate qui n'a pas tourné pendant trois jours doit rattraper son
    // retard, pas sauter un mois.
    const debut = "2026-03-01T12:00:00Z";
    expect(jour(prochaineEcheance(debut, 0))).toBe("2026-03-01");
    expect(jour(prochaineEcheance(debut, 1))).toBe("2026-04-01");
    expect(jour(prochaineEcheance(debut, 5))).toBe("2026-08-01");
  });
});

describe("doitOuvrirLeMois", () => {
  const base = {
    status: "active",
    months_total: 6,
    months_created: 2,
    starts_at: "2026-03-01T12:00:00Z",
  };

  it("ouvre quand l'échéance est arrivée", () => {
    expect(doitOuvrirLeMois(base, "2026-05-01T13:00:00Z")).toBe(true);
  });

  it("n'ouvre pas avant l'échéance", () => {
    expect(doitOuvrirLeMois(base, "2026-04-20T12:00:00Z")).toBe(false);
  });

  it("n'ouvre plus rien une fois les mois épuisés", () => {
    // Sans ce contrôle, un engagement de six mois continuerait d'ouvrir des
    // collaborations la septième année.
    expect(
      doitOuvrirLeMois({ ...base, months_created: 6 }, "2030-01-01T12:00:00Z"),
    ).toBe(false);
  });

  it("n'ouvre rien sur un engagement rompu", () => {
    expect(doitOuvrirLeMois({ ...base, status: "ended" }, "2026-05-01T12:00:00Z")).toBe(false);
  });

  it("rattrape un retard de l'automate", () => {
    // L'automate n'a pas tourné depuis deux mois : la prochaine échéance est
    // largement dépassée, il doit quand même ouvrir.
    expect(doitOuvrirLeMois(base, "2026-07-15T12:00:00Z")).toBe(true);
  });
});

describe("moisRestants", () => {
  it("compte ce qui reste, jamais en négatif", () => {
    expect(moisRestants(6, 2)).toBe(4);
    expect(moisRestants(6, 6)).toBe(0);
    expect(moisRestants(6, 9)).toBe(0);
  });
});

describe("coutTotal", () => {
  it("donne le chiffre que la marque doit avoir en tête", () => {
    // Le montant mensuel fait paraître l'engagement plus petit qu'il n'est.
    expect(coutTotal(400, 12)).toBe(4800);
  });

  it("ne rend rien de négatif", () => {
    expect(coutTotal(-400, 12)).toBe(0);
    expect(coutTotal(400, -3)).toBe(0);
  });
});

describe("libelleEngagement", () => {
  it("accorde le pluriel des contenus", () => {
    expect(libelleEngagement(6, 2, 400)).toBe("6 mois · 2 contenus/mois · 400€/mois");
    expect(libelleEngagement(3, 1, 250)).toBe("3 mois · 1 contenu/mois · 250€/mois");
  });
});

describe("finDuPreavis", () => {
  it("décale la rupture de 30 jours par défaut", () => {
    // Le préavis protège les deux parties : ni coupure la veille d'un tournage,
    // ni disparition au milieu d'une campagne construite autour du créateur.
    expect(jour(finDuPreavis("2026-03-01T12:00:00Z"))).toBe("2026-03-31");
  });

  it("accepte un préavis négocié", () => {
    expect(jour(finDuPreavis("2026-03-01T12:00:00Z", 15))).toBe("2026-03-16");
  });
});
