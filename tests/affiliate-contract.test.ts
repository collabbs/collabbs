import { describe, it, expect } from "vitest";
import {
  buildAffiliateContractDocument,
  type AffiliateContractSnapshot,
} from "@/lib/contract-template";
import type { PartySnapshot } from "@/lib/contract-snapshot";

/**
 * Le contrat-cadre d'affiliation comble un trou trouvé le 30 août 2026 : un
 * créateur en affiliation ou CPA pure n'avait jamais de contrat, alors que ses
 * commissions comptent dans le seuil légal de 1 000 €.
 *
 * Il ne fige PAS les taux — une relation d'affiliation dure et les campagnes
 * s'ajoutent. Ces tests vérifient que ce parti pris tient, et qu'aucun article
 * ne se vide.
 */

const party = (name: string): PartySnapshot => ({
  user_id: "u", display_name: name, legal_status_label: "Micro-entreprise",
  legal_name: name, rep_name: "Camille Roussel", address: "12 rue des Ateliers",
  city: "Lyon", zip: "69003", country: "France",
  siret: "912 345 678 00021", vat: "FR40912345678", contact_email: "a@b.c",
});

const snapshot = (over: Partial<AffiliateContractSnapshot> = {}): AffiliateContractSnapshot => ({
  version: 1, kind: "affiliate", generated_at: "2026-08-30T12:00:00Z",
  period_year: 2026, brand: party("MAISON VELO SAS"), creator: party("Sacha Bertin"),
  earned_to_date: 1240.5, platform_fee_pct: 25, validation_days: 30, min_payout: 20,
  ...over,
});

const texte = (doc: { clauses: { title: string; paragraphs: string[] }[]; footer: string[] }) =>
  [...doc.clauses.flatMap((c) => [c.title, ...c.paragraphs]), ...doc.footer].join("\n");

describe("contrat-cadre d'affiliation", () => {
  it("porte 10 articles, tous remplis", () => {
    const doc = buildAffiliateContractDocument({ reference: "CLB-A00001", snapshot: snapshot() });
    expect(doc.clauses).toHaveLength(10);
    for (const c of doc.clauses) {
      expect(c.title.trim(), `article ${c.number} sans titre`).not.toBe("");
      expect(
        c.paragraphs.join(" ").length,
        `article ${c.number} (${c.title}) quasi vide`,
      ).toBeGreaterThan(40);
    }
  });

  it("ne laisse aucun trou de gabarit dans le texte lu", () => {
    const lu = texte(buildAffiliateContractDocument({
      reference: "CLB-A00002", snapshot: snapshot(),
    }));
    for (const trou of ["undefined", "null", "[object Object]", "NaN", "À COMPLÉTER"]) {
      expect(lu, `le contrat contient « ${trou} »`).not.toContain(trou);
    }
  });

  it("couvre les mentions que la loi impose", () => {
    const lu = texte(buildAffiliateContractDocument({
      reference: "CLB-A00003", snapshot: snapshot(),
    }));
    // Transparence publicitaire — le cœur de la loi sur l'influence.
    expect(lu).toContain("2023-451");
    expect(lu).toContain("Collaboration commerciale");
    // Contenus générés par IA représentant une personne.
    expect(lu).toContain("intelligence artificielle");
    // Collabbs n'est pas partie au contrat : la requalification coûte cher.
    expect(lu).toContain("n'est pas partie au contrat");
    // Fraude à l'attribution — propre à l'affiliation.
    expect(lu).toContain("achat de trafic");
    // Valeur probante de la signature électronique.
    expect(lu).toContain("1367");
  });

  it("ne fige pas les taux de commission", () => {
    const lu = texte(buildAffiliateContractDocument({
      reference: "CLB-A00004", snapshot: snapshot(),
    }));
    // Il renvoie aux conditions de chaque campagne, sans les recopier : un
    // contrat signé en mars ne peut pas décrire une campagne de juillet.
    expect(lu).toContain("telle qu'affichée sur la plateforme");
  });

  it("annonce les frais comme s'ajoutant, jamais comme déduits", () => {
    const lu = texte(buildAffiliateContractDocument({
      reference: "CLB-A00005", snapshot: snapshot(),
    }));
    expect(lu).toContain("supportés par l'annonceur **en sus**");
    expect(lu).toContain("n'en est jamais diminuée");
  });

  it("dit honnêtement qu'aucune commission n'est acquise, le cas échéant", () => {
    const lu = texte(buildAffiliateContractDocument({
      reference: "CLB-A00006", snapshot: snapshot({ earned_to_date: 0 }),
    }));
    expect(lu).toContain("Aucune commission n'était acquise");
  });

  it("numérote les articles sans trou", () => {
    const doc = buildAffiliateContractDocument({ reference: "CLB-A00007", snapshot: snapshot() });
    expect(doc.clauses.map((c) => c.number)).toEqual(
      Array.from({ length: doc.clauses.length }, (_, i) => String(i + 1)),
    );
  });

  it("refuse un instantané amputé plutôt que de produire un contrat troué", () => {
    expect(() =>
      buildAffiliateContractDocument({
        reference: "CLB-A00008",
        snapshot: { ...snapshot(), creator: undefined as unknown as PartySnapshot },
      }),
    ).toThrow();
  });
});
