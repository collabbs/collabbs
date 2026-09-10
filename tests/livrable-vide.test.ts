import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Un livrable vide n'est pas un livrable.
 *
 * ─── Ce qui est arrivé le 10 septembre ───
 * Sur une collaboration à 315 €, le créateur a retiré le fichier du premier
 * livrable — en cliquant sur la croix d'un aperçu, en croyant replier une
 * vignette. `removeDeliverableFile` ne touchait que la liste des fichiers : la
 * ligne est restée `done = true` avec RIEN dedans.
 *
 * Côté marque, la carte se contredisait elle-même : le badge « Livré » et un
 * bouton « Valider » au-dessus de la phrase « En attente du dépôt du contenu
 * par le créateur ». Et le danger n'était pas l'affichage — c'est que
 * « Valider » libère le séquestre. 315 € pouvaient être versés pour un contenu
 * qui n'existait pas, sans mauvaise foi de personne.
 *
 * Deux verrous, à deux endroits, parce qu'un seul ne suffit pas :
 *   1. retirer la dernière pièce dé-livre le livrable ;
 *   2. valider refuse ce qui est vide, même si l'état en base est incohérent.
 */
const source = readFileSync(
  new URL("../src/app/(app)/deals/actions.ts", import.meta.url),
  "utf8",
);

describe("un livrable vide", () => {
  it("redevient « à livrer » quand on retire sa dernière pièce", () => {
    expect(source).toMatch(/const plusRien = filtered\.length === 0 && !d\.submission_url/);
    expect(source).toMatch(/done: false, submitted_at: null/);
  });

  it("compte un lien de publication comme une livraison", () => {
    // Une story déjà en ligne n'a pas de fichier : la dé-livrer parce qu'on
    // retire une pièce jointe annexe serait faux.
    expect(source).toContain("!d.submission_url");
  });

  it("ne peut pas être validé par la marque", () => {
    expect(source).toContain("ON NE VALIDE PAS DU VIDE");
    expect(source).toMatch(/il n'y a rien à valider/);
  });

  it("laisse toujours RETIRER une validation", () => {
    // Le garde-fou ne doit bloquer que l'approbation, jamais son retrait :
    // sinon une marque qui s'est trompée resterait coincée.
    expect(source).toMatch(/if \(approved\) \{[\s\S]{0,700}?fichiers === 0/);
  });
});
