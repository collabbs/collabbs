import { describe, it, expect } from "vitest";
import {
  etatExpedition,
  adresseLivraison,
  adresseEnUneLigne,
  lienDeSuivi,
} from "@/lib/expedition";

const ADRESSE_OK = {
  name: "Julien Dreneau",
  line1: "12 rue des Halles",
  zip: "37000",
  city: "Tours",
  country: "France",
};

describe("etatExpedition", () => {
  it("suit les quatre moments dans l'ordre", () => {
    expect(etatExpedition({})).toBe("adresse_manquante");
    expect(etatExpedition({ shipping_address: ADRESSE_OK })).toBe("a_expedier");
    expect(
      etatExpedition({ shipping_address: ADRESSE_OK, shipped_at: "2026-08-30T10:00:00Z" }),
    ).toBe("en_transit");
    expect(
      etatExpedition({
        shipping_address: ADRESSE_OK,
        shipped_at: "2026-08-30T10:00:00Z",
        received_at: "2026-09-02T10:00:00Z",
      }),
    ).toBe("recu");
  });

  it("ne considère pas une adresse incomplète comme une adresse", () => {
    // Sans code postal, la marque croirait pouvoir expédier.
    expect(etatExpedition({ shipping_address: { ...ADRESSE_OK, zip: "" } })).toBe(
      "adresse_manquante",
    );
  });
});

describe("adresseLivraison", () => {
  it("rend l'adresse quand elle est exploitable", () => {
    expect(adresseLivraison(ADRESSE_OK)?.city).toBe("Tours");
  });

  it("rend null sur tout ce qui n'est pas une adresse", () => {
    expect(adresseLivraison(null)).toBeNull();
    expect(adresseLivraison("12 rue des Halles")).toBeNull();
    expect(adresseLivraison({})).toBeNull();
    expect(adresseLivraison({ ...ADRESSE_OK, city: "   " })).toBeNull();
  });

  it("garde les champs facultatifs seulement s'ils sont remplis", () => {
    const a = adresseLivraison({ ...ADRESSE_OK, line2: "  ", phone: "0612345678" });
    expect(a?.line2).toBeUndefined();
    expect(a?.phone).toBe("0612345678");
  });
});

describe("adresseEnUneLigne", () => {
  it("saute les champs absents sans laisser de virgule orpheline", () => {
    expect(adresseEnUneLigne(ADRESSE_OK)).toBe(
      "Julien Dreneau, 12 rue des Halles, 37000 Tours, France",
    );
  });
});

describe("lienDeSuivi", () => {
  it("construit le lien des transporteurs connus", () => {
    expect(lienDeSuivi("Colissimo", "6A123456789")).toContain("laposte.fr");
    expect(lienDeSuivi("mondial relay", "12345")).toContain("mondialrelay.fr");
  });

  it("échappe le numéro plutôt que de le coller tel quel", () => {
    expect(lienDeSuivi("UPS", "1Z 999 AA")).toContain("1Z%20999%20AA");
  });

  it("ne fabrique PAS de lien pour un transporteur inconnu", () => {
    // Un lien qui tombe sur une page d'erreur ferait croire au colis perdu.
    expect(lienDeSuivi("Le voisin", "12345")).toBeNull();
  });

  it("ne rend rien sans numéro", () => {
    expect(lienDeSuivi("Colissimo", null)).toBeNull();
    expect(lienDeSuivi(null, "6A123456789")).toBeNull();
  });
});
