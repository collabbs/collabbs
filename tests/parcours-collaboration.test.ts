import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * L'étape « Contrat signé » se calcule sur les SIGNATURES.
 *
 * ─── Ce qui est arrivé le 12 septembre ───
 * Une collaboration active, dont le contrat portait les deux signatures depuis
 * le 30 mai, s'affichait « étape 2/6 — en attente du créateur ». Julien l'a vu
 * immédiatement : « c'est déjà accepté non ? ». Oui, ça l'était.
 *
 * La cause : l'étape se calculait sur `accepted_at`, un horodatage du DEAL, et
 * non sur l'état du CONTRAT. Toute collaboration sans cet horodatage — données
 * anciennes, chemin de création qui ne le pose pas — restait bloquée à
 * l'étape 2, indéfiniment.
 *
 * Un écran de suivi qui se trompe d'étape est pire qu'un écran sans suivi : il
 * fait douter de ce qu'on vient de faire, et il pousse à refaire.
 */
const timeline = readFileSync(
  new URL("../src/app/(app)/deals/[id]/DealTimeline.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/app/(app)/deals/[id]/page.tsx", import.meta.url),
  "utf8",
);

describe("l'étape « Contrat signé »", () => {
  it("se fonde d'abord sur la signature du contrat", () => {
    expect(timeline).toMatch(/stepSignedDone =\s*Boolean\(deal\.contract_signed_at\)/);
  });

  it("garde `accepted_at` en second recours, pas en condition", () => {
    // Les collaborations anciennes n'ont pas toujours de contrat conservé :
    // on ne veut pas les faire régresser en réparant les autres.
    expect(timeline).toMatch(/\|\|\s*\(deal\.status !== "negotiation" && Boolean\(deal\.accepted_at\)\)/);
  });

  it("exige les DEUX signatures, pas une seule", () => {
    expect(page).toMatch(/contract\?\.brand_signed_at && contract\?\.creator_signed_at/);
  });

  it("affiche la plus tardive des deux dates", () => {
    // Un contrat n'est signé qu'au moment de la seconde signature.
    expect(page).toMatch(/contract\.brand_signed_at > contract\.creator_signed_at/);
  });
});
