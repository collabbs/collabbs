import { describe, it, expect } from "vitest";
import { buildContractDocument } from "@/lib/contract-template";
import type { ContractSnapshot, PartySnapshot } from "@/lib/contract-snapshot";

const party = (name: string): PartySnapshot => ({
  user_id: "u",
  display_name: name,
  legal_status_label: "Micro-entreprise",
  legal_name: name,
  rep_name: null,
  address: "1 rue de la Paix",
  city: "Paris",
  zip: "75002",
  country: "France",
  siret: "123",
  vat: null,
  contact_email: "a@b.c",
});

const snapshot = (over: Partial<ContractSnapshot["deal"]> = {}): ContractSnapshot => ({
  version: 1,
  generated_at: "2026-08-29T10:00:00Z",
  brand: party("Marque"),
  creator: party("Créateur"),
  deal: {
    title: "Test",
    amount: 500,
    format: "ugc",
    platform_id: null,
    quantity: 2,
    deadline: null,
    brand_notes: null,
    exclusivity: false,
    exclusivity_days: null,
    usage_rights_months: null,
    ...over,
  },
});

/**
 * Le contrat doit contenir les mentions rendues obligatoires par le décret
 * n° 2025-1137 dès que le seuil de 1 000 € est franchi. Un article qui
 * disparaîtrait d'une refonte ne doit pas passer inaperçu.
 */
describe("contrat de collaboration", () => {
  it("le régime complet couvre les mentions obligatoires", () => {
    const doc = buildContractDocument({
      reference: "CLB-TEST",
      snapshot: snapshot(),
      regime: "complete",
    });
    const titles = doc.clauses.map((c) => c.title).join(" | ");
    expect(titles).toContain("Parties au contrat");
    expect(titles).toContain("Objet et description des prestations");
    expect(titles).toContain("Rémunération et avantages en nature");
    expect(titles).toContain("Transparence publicitaire");
    expect(titles).toContain("Responsabilité des Parties");
    expect(titles).toContain("Données personnelles");
    expect(titles).toContain("Droit applicable");
  });

  it("le régime simplifié reste plus court mais garde la transparence", () => {
    const simple = buildContractDocument({
      reference: "CLB-TEST",
      snapshot: snapshot(),
      regime: "simplified",
    });
    const complete = buildContractDocument({
      reference: "CLB-TEST",
      snapshot: snapshot(),
      regime: "complete",
    });
    expect(simple.clauses.length).toBeLessThan(complete.clauses.length);
    // La mention publicitaire s'impose quel que soit le montant.
    expect(simple.clauses.map((c) => c.title)).toContain("Transparence publicitaire");
  });

  it("mentionne le pays de résidence fiscale des deux parties", () => {
    const doc = buildContractDocument({
      reference: "CLB-TEST",
      snapshot: snapshot(),
      regime: "complete",
    });
    const parties = doc.clauses[0].paragraphs.join(" ");
    expect(parties).toContain("résidence fiscale");
  });

  it("dit explicitement qu'il n'y a pas d'exclusivité quand il n'y en a pas", () => {
    const doc = buildContractDocument({
      reference: "CLB-TEST",
      snapshot: snapshot({ exclusivity: false }),
      regime: "complete",
    });
    const exclu = doc.clauses.find((c) => c.title === "Exclusivité");
    expect(exclu?.paragraphs.join(" ")).toContain("Aucune clause d'exclusivité");
  });

  it("refuse de générer un document depuis un snapshot incomplet", () => {
    const broken = { version: 1, generated_at: "x" } as unknown as ContractSnapshot;
    expect(() =>
      buildContractDocument({ reference: "CLB-X", snapshot: broken, regime: "complete" }),
    ).toThrow();
  });

  it("numérote les articles sans trou", () => {
    const doc = buildContractDocument({
      reference: "CLB-TEST",
      snapshot: snapshot(),
      regime: "complete",
    });
    expect(doc.clauses.map((c) => c.number)).toEqual(
      doc.clauses.map((_, i) => String(i + 1)),
    );
  });

  /**
   * « Le grand test » du 30 août 2026 : jusqu'ici, aucun compte n'ayant jamais
   * eu d'informations légales, le contrat n'avait **jamais été rendu une seule
   * fois**. Ce test le rend avec un dossier complet des deux côtés et vérifie
   * qu'aucun article n'est vide et qu'aucun trou de gabarit n'atteint le texte
   * lu par les Parties.
   */
  it("avec un dossier complet, chaque article porte un texte réel", () => {
    const doc = buildContractDocument({
      reference: "CT-2026-0001",
      regime: "complete",
      snapshot: {
        ...snapshot({
          title: "Vidéo test du vélo urbain",
          amount: 1400,
          format: "video",
          deadline: "2026-09-30",
          brand_notes: "Tournage en extérieur.",
          exclusivity: true,
          exclusivity_days: 60,
          usage_rights_months: 12,
        }),
        brand: { ...party("MAISON VELO SAS"), rep_name: "Camille Roussel", vat: "FR40912345678" },
      },
    });

    // 11 articles au maximum : le gabarit compte 13 appels, dont deux paires
    // « si/sinon » (transparence publicitaire, exclusivité).
    expect(doc.clauses).toHaveLength(11);

    for (const c of doc.clauses) {
      expect(c.title.trim(), `article ${c.number} sans titre`).not.toBe("");
      expect(c.paragraphs.length, `article ${c.number} sans paragraphe`).toBeGreaterThan(0);
      expect(
        c.paragraphs.join(" ").length,
        `article ${c.number} (${c.title}) quasi vide`,
      ).toBeGreaterThan(40);
    }

    // On n'inspecte que le TEXTE lu par les Parties — pas le JSON, où un
    // `null` de métadonnée est légitime.
    const lu = [
      ...doc.clauses.flatMap((c) => [c.title, ...c.paragraphs]),
      ...doc.footer,
    ].join("\n");
    for (const trou of ["undefined", "[object Object]", "NaN", "À COMPLÉTER", "TODO", "null"]) {
      expect(lu, `le texte du contrat contient « ${trou} »`).not.toContain(trou);
    }
  });

  it("un dossier incomplet ne laisse pas de trou dans le texte", () => {
    // Le régime simplifié tolère des champs manquants : ils ne doivent pas
    // ressortir en « undefined » au milieu d'une phrase.
    const creuse: PartySnapshot = {
      ...party("Sans Papiers"),
      legal_status_label: null,
      rep_name: null,
      siret: null,
      vat: null,
      contact_email: null,
    };
    const doc = buildContractDocument({
      reference: "CT-2026-0002",
      regime: "simplified",
      snapshot: { ...snapshot(), creator: creuse },
    });
    const lu = doc.clauses.flatMap((c) => c.paragraphs).join("\n");
    for (const trou of ["undefined", "null", "[object Object]", ", ,", " ."]) {
      expect(lu, `trou de gabarit « ${trou} »`).not.toContain(trou);
    }
  });

  /**
   * Les libellés de format sont des locutions, pas des noms isolés. Le code
   * leur ajoutait un « s » au pluriel, ce qui produisait « 2 vidéo publiée sur
   * les réseaux sociauxs » — une faute d'accord et un mot inexistant, dans un
   * document juridique. Constaté le 30 août 2026 en lisant le contrat à
   * l'écran pour la première fois.
   */
  it("accorde le format au nombre, sans inventer de mot", () => {
    const attendus: [string, number, string][] = [
      ["video_post", 1, "1 vidéo publiée sur les réseaux sociaux."],
      ["video_post", 2, "2 vidéos publiées sur les réseaux sociaux."],
      ["story", 3, "3 stories publiées sur les réseaux sociaux."],
      ["reel", 2, "2 reels publiés sur les réseaux sociaux."],
      ["ugc", 4, "4 contenus générés par l'utilisateur (UGC), livrés à l'annonceur."],
      ["live", 2, "2 sessions en direct (live)."],
    ];
    for (const [format, quantity, fin] of attendus) {
      const doc = buildContractDocument({
        reference: "CT", regime: "complete", snapshot: snapshot({ format, quantity }),
      });
      const objet = doc.clauses.find((c) => c.title.startsWith("Objet"))!;
      const ligne = objet.paragraphs.find((x) => x.includes("Nature de la prestation"))!;
      expect(ligne, `${format} ×${quantity}`).toContain(fin);
    }
  });

  it("ne déforme pas un format inconnu", () => {
    const doc = buildContractDocument({
      reference: "CT", regime: "complete",
      snapshot: snapshot({ format: "podcast", quantity: 3 }),
    });
    const ligne = doc.clauses
      .find((c) => c.title.startsWith("Objet"))!
      .paragraphs.find((x) => x.includes("Nature de la prestation"))!;
    // Rendu tel quel plutôt qu'affublé d'un « s » hasardeux.
    expect(ligne).toContain("3 podcast.");
  });
});
