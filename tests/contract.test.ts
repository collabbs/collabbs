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
});
