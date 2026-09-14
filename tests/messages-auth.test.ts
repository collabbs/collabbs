import { describe, it, expect } from "vitest";
import { messageAuth } from "@/lib/messages-auth";

describe("messages d'authentification", () => {
  it("traduit les erreurs que Supabase renvoie vraiment", () => {
    expect(messageAuth("Invalid login credentials")).toMatch(/mot de passe incorrect/i);
    expect(messageAuth("Email not confirmed")).toMatch(/confirmée/i);
    expect(messageAuth("User already registered")).toMatch(/existe déjà/i);
  });

  it("ne révèle jamais si l'adresse existe", () => {
    // Distinguer « adresse inconnue » de « mot de passe incorrect » permet de
    // tester en masse quelles adresses ont un compte chez nous.
    const m = messageAuth("Invalid login credentials");
    expect(m).not.toMatch(/inconnue|n'existe pas|aucun compte/i);
  });

  it("ne laisse jamais passer l'anglais d'origine", () => {
    for (const brut of ["Something unexpected", "Database error saving new user", ""]) {
      const m = messageAuth(brut);
      expect(m).not.toContain(brut || "×");
      expect(m).toMatch(/[éèêàçù]/);
    }
  });

  it("dit toujours quoi faire ensuite", () => {
    for (const brut of ["Invalid login credentials", "Email not confirmed", "n'importe quoi"]) {
      expect(messageAuth(brut)).toMatch(/réessaie|vérifie|ouvre|connecte|demande|choisis|attends|écris/i);
    }
  });
});
