import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  signatureValide,
  domaineBoutique,
  referenceDeLaCommande,
  montantDeLaCommande,
  referenceExterne,
} from "@/lib/shopify-webhook";

const SECRET = "cle-de-signature-shopify";
const signer = (corps: string, secret = SECRET) =>
  createHmac("sha256", secret).update(corps, "utf8").digest("base64");

describe("la signature d'un webhook Shopify", () => {
  it("accepte un corps correctement signé", () => {
    const corps = '{"id":123,"total_price":"49.00"}';
    expect(signatureValide(corps, signer(corps), SECRET)).toBe(true);
  });

  it("refuse un corps modifié après signature", () => {
    // Le cas qui compte : quelqu'un intercepte et gonfle le montant.
    const corps = '{"id":123,"total_price":"49.00"}';
    const signature = signer(corps);
    const falsifie = '{"id":123,"total_price":"4900.00"}';
    expect(signatureValide(falsifie, signature, SECRET)).toBe(false);
  });

  it("refuse une signature d'un autre secret", () => {
    const corps = '{"id":123}';
    expect(signatureValide(corps, signer(corps, "autre-cle"), SECRET)).toBe(false);
  });

  it("refuse quand il manque la signature ou le secret", () => {
    const corps = '{"id":123}';
    expect(signatureValide(corps, null, SECRET)).toBe(false);
    expect(signatureValide(corps, signer(corps), null)).toBe(false);
    expect(signatureValide(corps, "", SECRET)).toBe(false);
  });

  it("une signature de longueur différente ne fait pas planter", () => {
    // `timingSafeEqual` lève sur des longueurs inégales : sans garde, toute
    // signature tronquée renverrait une erreur 500 au lieu d'un refus.
    expect(() => signatureValide('{"a":1}', "trop-court", SECRET)).not.toThrow();
    expect(signatureValide('{"a":1}', "trop-court", SECRET)).toBe(false);
  });

  it("l'espacement du corps change la signature", () => {
    // D'où la lecture du corps BRUT : re-sérialiser l'objet casserait tout.
    const corps = '{"id":123,"total_price":"49.00"}';
    const reserialise = JSON.stringify(JSON.parse(corps), null, 2);
    expect(signatureValide(reserialise, signer(corps), SECRET)).toBe(false);
  });
});

describe("le domaine de la boutique", () => {
  it("se normalise pour la comparaison", () => {
    for (const v of [
      "ma-marque.myshopify.com",
      "MA-MARQUE.myshopify.com",
      "https://ma-marque.myshopify.com",
      "https://ma-marque.myshopify.com/admin",
      "  ma-marque.myshopify.com  ",
    ]) {
      expect(domaineBoutique(v)).toBe("ma-marque.myshopify.com");
    }
  });

  it("rend null sur du vide", () => {
    expect(domaineBoutique(null)).toBeNull();
    expect(domaineBoutique("   ")).toBeNull();
  });
});

describe("la référence du créateur dans la commande", () => {
  it("se lit dans les attributs posés par le tracker", () => {
    const r = referenceDeLaCommande({
      note_attributes: [
        { name: "autre_chose", value: "x" },
        { name: "collabbs_ref", value: "4456039a36" },
        { name: "collabbs_clicked_at", value: "2026-09-19T14:21:44.560Z" },
      ],
    });
    expect(r.code).toBe("4456039a36");
    expect(r.clicke).toBe("2026-09-19T14:21:44.560Z");
  });

  it("une commande ordinaire n'en a pas, et ce n'est pas une erreur", () => {
    // La très grande majorité des ventes d'une boutique.
    expect(referenceDeLaCommande({}).code).toBeNull();
    expect(referenceDeLaCommande({ note_attributes: [] }).code).toBeNull();
  });

  it("ne fait confiance à aucune forme venue de la boutique", () => {
    const r = referenceDeLaCommande({
      note_attributes: [
        null as never,
        { name: 42 as never, value: "x" },
        { name: "collabbs_ref", value: "   " },
      ],
    });
    expect(r.code).toBeNull();
  });
});

describe("le montant de la commande", () => {
  it("lit les montants que Shopify envoie en chaîne", () => {
    // Sans conversion, la première multiplication donne NaN et la commission
    // tombe à zéro — sans erreur nulle part.
    expect(montantDeLaCommande({ total_price: "629.95" })).toBe(629.95);
    expect(montantDeLaCommande({ total_price: "49,00" })).toBe(49);
  });

  it("le montant courant prime sur le montant d'origine", () => {
    // Une commande modifiée après coup : c'est le montant réel qui compte.
    expect(montantDeLaCommande({ total_price: "100.00", current_total_price: "80.00" })).toBe(80);
  });

  it("rend zéro sur tout ce qui n'est pas un montant", () => {
    for (const v of [undefined, null, "", "gratuit", "-10", "0"]) {
      expect(montantDeLaCommande({ total_price: v as never })).toBe(0);
    }
  });
});

describe("le numéro qui empêche de payer deux fois", () => {
  it("part de l'identifiant de commande", () => {
    expect(referenceExterne({ id: 12091207123055 })).toBe("shopify-12091207123055");
  });

  it("se rabat sur le numéro visible, puis sur le jeton de paiement", () => {
    expect(referenceExterne({ order_number: 1042 })).toBe("shopify-1042");
    expect(referenceExterne({ checkout_token: "hWNH0yGS" })).toBe("shopify-hWNH0yGS");
  });

  it("rend null quand rien n'identifie la commande", () => {
    // Shopify réessaie jusqu'à huit fois : sans numéro, le créateur toucherait
    // huit commissions pour une seule vente. On préfère ne rien enregistrer.
    expect(referenceExterne({})).toBeNull();
    expect(referenceExterne({ id: Number.NaN })).toBeNull();
  });

  it("le préfixe évite toute collision avec un numéro d'une autre source", () => {
    // Le postback d'une boutique maison pourrait envoyer « 1042 » aussi.
    expect(referenceExterne({ order_number: 1042 })).toMatch(/^shopify-/);
  });
});
