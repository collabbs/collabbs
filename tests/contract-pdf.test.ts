import { describe, it, expect } from "vitest";
import { inflateSync } from "node:zlib";
import { buildContractDocument } from "@/lib/contract-template";
import { renderContractPdf, winAnsiSafe } from "@/lib/contract-pdf";
import type { ContractSnapshot, PartySnapshot } from "@/lib/contract-snapshot";

/**
 * Le PDF est composé en Helvetica non embarquée, encodage WinAnsi. Un
 * caractère absent de cet encodage n'y provoque pas d'erreur : il est dessiné
 * avec un AUTRE glyphe, en silence.
 *
 * Défaut trouvé le 30 août 2026 en affichant le contrat pour la première fois :
 * l'espace fine insécable (U+202F) que `toLocaleString("fr-FR")` place en
 * séparateur de milliers sortait en **barre oblique**. Le contrat annonçait
 * « la somme de 1/400,00 € ». Seuls les montants à partir de 1 000 € étaient
 * touchés — exactement ceux pour lesquels la loi impose le contrat écrit.
 */

const party = (name: string): PartySnapshot => ({
  user_id: "u", display_name: name, legal_status_label: "Micro-entreprise",
  legal_name: name, rep_name: "Camille Roussel", address: "12 rue des Ateliers",
  city: "Lyon", zip: "69003", country: "France",
  siret: "912 345 678 00021", vat: "FR40912345678", contact_email: "a@b.c",
});

const snapshot = (amount: number): ContractSnapshot => ({
  version: 1, generated_at: "2026-08-30T09:00:00.000Z", regime: "complete",
  brand: party("MAISON VELO SAS"), creator: party("Sacha Bertin"),
  deal: {
    title: "Vidéo test du vélo urbain", amount, format: "video",
    platform_id: 1, quantity: 2, deadline: "2026-09-30",
    brand_notes: "Tournage en extérieur.",
    exclusivity: true, exclusivity_days: 60, usage_rights_months: 12,
    usage_rights_scope: null, usage_rights_fee: null,
  },
});

/** Rassemble les octets réellement dessinés dans le PDF. */
function texteDessine(pdf: Buffer): Buffer {
  const flux = [...pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .map((m) => {
      try { return inflateSync(Buffer.from(m[1], "latin1")); } catch { return Buffer.alloc(0); }
    });
  const contenu = Buffer.concat(flux).toString("latin1");
  const morceaux = [...contenu.matchAll(/\[([\s\S]*?)\]\s*TJ/g)].map((m) =>
    Buffer.from(
      [...m[1].matchAll(/<([0-9A-Fa-f]+)>/g)].map((h) => h[1]).join(""),
      "hex",
    ),
  );
  return Buffer.concat(morceaux);
}

describe("rendu PDF du contrat", () => {
  it("écrit le séparateur de milliers, pas une barre oblique", async () => {
    const doc = buildContractDocument({
      reference: "CT-2026-0001", regime: "complete", snapshot: snapshot(1400),
    });
    const pdf = await renderContractPdf({
      doc, brandSignedAt: "2026-08-30T09:12:00.000Z",
      creatorSignedAt: "2026-08-30T10:04:00.000Z", terminatedAt: null,
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

    const dessine = texteDessine(pdf);
    const i = dessine.indexOf("somme de");
    expect(i, "clause de rémunération introuvable dans le PDF").toBeGreaterThan(-1);

    const montant = dessine.subarray(i + 9, i + 18);
    // « 1 » · espace insécable · « 400,00 »
    expect(montant[0]).toBe(0x31);
    expect(montant[1], "le séparateur de milliers n'est pas une espace").toBe(0xa0);
    expect(montant[2]).toBe(0x34);
    // La barre oblique du défaut d'origine ne doit plus apparaître.
    expect(dessine.includes(Buffer.from([0x31, 0x2f, 0x34]))).toBe(false);
  }, 60000);

  it("les 11 articles atteignent le PDF", async () => {
    const doc = buildContractDocument({
      reference: "CT-2026-0002", regime: "complete", snapshot: snapshot(1400),
    });
    const pdf = await renderContractPdf({
      doc, brandSignedAt: null, creatorSignedAt: null, terminatedAt: null,
    });
    const lu = texteDessine(pdf).toString("latin1");
    for (const c of doc.clauses) {
      // Le titre peut être coupé en fin de ligne : on cherche son premier mot.
      const debut = c.title.split(" ")[0];
      expect(lu, `article ${c.number} « ${c.title} » absent du PDF`).toContain(debut);
    }
  }, 60000);

  it("neutralise les caractères hors WinAnsi plutôt que d'inventer un glyphe", () => {
    // Échappements explicites : un caractère invisible tapé à la main ne
    // prouverait rien.
    expect(winAnsiSafe("1\u202F400")).toBe("1\u00A0400"); // espace fine → insécable
    expect(winAnsiSafe("a\u2009b")).toBe("a\u00A0b");     // espace fine simple
    expect(winAnsiSafe("non\u2011cassable")).toBe("non-cassable");
    // Un caractère franchement hors encodage laisse un blanc, pas un faux signe.
    expect(winAnsiSafe("prix \u4E2D")).toBe("prix  ");
    // La typographie française courante doit passer intacte.
    expect(winAnsiSafe("« l'été — 100 % »")).toBe("« l'été — 100 % »");
  });
});
