import { describe, it, expect } from "vitest";
import {
  coordonneesLegalesSchema,
  siretValide,
  tvaValide,
} from "@/lib/schemas/legal";
import { valider } from "@/lib/validation";

/**
 * Ces valeurs finissent GELÉES dans un contrat signé : une fois la signature
 * posée, l'instantané ne bouge plus. Un SIRET erroné y devient définitif, dans
 * un document qu'une partie pourrait produire en justice.
 *
 * Mais rien n'est obligatoire ici : sous 1 000 € par an la loi n'exige pas ces
 * mentions, et un créateur qui fait sa première collaboration à 80 € n'a
 * souvent aucun statut juridique.
 */

const vide = {
  status: "", legalName: "", repName: "", address: "",
  city: "", zip: "", country: "", siret: "", vat: "", contactEmail: "",
};

describe("clé de contrôle du SIRET", () => {
  it("accepte un SIRET réel", () => {
    // Siège d'EDF — clé vérifiée indépendamment.
    expect(siretValide("55208131766522")).toBe(true);
  });

  it("attrape la faute de frappe", () => {
    // Un chiffre changé sur un SIRET valide casse la clé.
    expect(siretValide("55208131766523")).toBe(false);
    expect(siretValide("91234567800021")).toBe(false);
  });

  it("accepte le SIREN à 9 chiffres, que le formulaire propose", () => {
    // SIREN d'EDF et de Renault. La clé du SIREN se calcule sur 9 chiffres,
    // avec un décalage de parité par rapport au SIRET : la même boucle ne
    // marche pour les deux que si on compte depuis la DROITE.
    expect(siretValide("552081317")).toBe(true);
    expect(siretValide("441639465")).toBe(true);
    // Un chiffre changé casse la clé, là aussi.
    expect(siretValide("552081318")).toBe(false);
  });

  it("refuse ce qui n'est ni 9 ni 14 chiffres", () => {
    expect(siretValide("5520813")).toBe(false);
    expect(siretValide("5520813176652")).toBe(false);
    expect(siretValide("abcdefghijklmn")).toBe(false);
  });

  it("accepte les espaces de saisie", () => {
    expect(siretValide("552 081 317 66522")).toBe(true);
  });

  it("laisse passer La Poste, exception historique à la clé", () => {
    expect(siretValide("35600000000048")).toBe(true);
  });
});

describe("numéro de TVA", () => {
  it("accepte un numéro français bien formé", () => {
    expect(tvaValide("FR40912345678")).toBe(true);
    expect(tvaValide("fr 40 912345678")).toBe(true);
  });

  it("refuse un numéro français tronqué", () => {
    expect(tvaValide("FR409")).toBe(false);
  });

  it("laisse passer les autres pays sans prétendre connaître leur format", () => {
    // Refuser à tort un numéro belge valide serait pire que le laisser passer.
    expect(tvaValide("BE0123456789")).toBe(true);
  });
});

describe("coordonnées légales", () => {
  it("accepte un profil entièrement vide", () => {
    // C'est le cas du créateur débutant : rien ne doit l'empêcher d'enregistrer.
    expect(valider(coordonneesLegalesSchema, vide).ok).toBe(true);
  });

  it("refuse un SIRET erroné, mais pas son absence", () => {
    expect(valider(coordonneesLegalesSchema, { ...vide, siret: "12345678900000" }).ok).toBe(false);
    expect(valider(coordonneesLegalesSchema, { ...vide, siret: "" }).ok).toBe(true);
  });

  it("refuse une adresse électronique qui n'en est pas une", () => {
    expect(valider(coordonneesLegalesSchema, { ...vide, contactEmail: "pas-un-email" }).ok).toBe(false);
    expect(valider(coordonneesLegalesSchema, { ...vide, contactEmail: "a@b.fr" }).ok).toBe(true);
  });

  it("refuse un statut juridique inventé", () => {
    expect(valider(coordonneesLegalesSchema, { ...vide, status: "licorne" }).ok).toBe(false);
    expect(valider(coordonneesLegalesSchema, { ...vide, status: "micro" }).ok).toBe(true);
  });

  it("contrôle le code postal pour la France seulement", () => {
    expect(valider(coordonneesLegalesSchema, { ...vide, country: "France", zip: "690" }).ok).toBe(false);
    expect(valider(coordonneesLegalesSchema, { ...vide, country: "France", zip: "69003" }).ok).toBe(true);
    // Un code postal britannique ne s'écrit pas en 5 chiffres.
    expect(valider(coordonneesLegalesSchema, { ...vide, country: "Royaume-Uni", zip: "SW1A 1AA" }).ok).toBe(true);
  });

  it("dit à l'utilisateur où vérifier", () => {
    const r = valider(coordonneesLegalesSchema, { ...vide, siret: "12345678900000" });
    if (!r.ok) expect(r.error).toContain("Kbis");
  });
});
