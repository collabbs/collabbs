import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * À qui Collabbs s'autorise à écrire.
 *
 * ─── Ce que ce fichier empêche de revenir ───
 * Les comptes de démonstration portent des adresses en `@collabbs.test` (un
 * domaine RÉSERVÉ par la RFC 2606 : il ne résout jamais) et `@collabbs.dev`
 * (aucun MX). Chaque envoi vers ces adresses est un rebond dur, et un domaine
 * d'expédition neuf n'en supporte pas beaucoup avant d'être classé
 * indésirable — chez tout le monde, pour les vrais destinataires aussi.
 *
 * Ce garde-fou a d'abord été posé dans UN cron sur huit. Le 10 septembre à
 * 9h30, un autre cron — `profile-incomplete`, qui tourne tous les jours — a
 * tenté 28 envois vers `.test`. Protéger chaque appelant, c'est oublier le
 * neuvième.
 *
 * Il vit donc dans `notify`, à l'endroit exact où Resend est appelé : tous les
 * chemins d'envoi passent par là, y compris ceux qui n'existent pas encore.
 */
const source = readFileSync(new URL("../src/lib/notifications.ts", import.meta.url), "utf8");

describe("le courrier sortant", () => {
  it("refuse les domaines qui ne reçoivent rien, dans notify lui-même", () => {
    for (const d of ["@collabbs.test", "@collabbs.dev", "@example.com"]) {
      expect(source).toContain(d);
    }
  });

  it("décide AVANT d'appeler Resend, pas après", () => {
    const garde = source.indexOf("DOMAINES_SANS_COURRIER.some");
    const envoi = source.indexOf("resend.emails.send");
    expect(garde).toBeGreaterThan(0);
    expect(envoi).toBeGreaterThan(garde);
  });

  it("écrit quand même la notification en base", () => {
    // Elle est visible dans le produit, elle ne coûte rien, et elle garde la
    // trace de ce qui aurait été dit. Seul l'EMAIL est retenu.
    const insertion = source.indexOf('.from("notifications")');
    const garde = source.indexOf("DOMAINES_SANS_COURRIER.some");
    expect(insertion).toBeGreaterThan(0);
    expect(insertion).toBeLessThan(garde);
  });
});
