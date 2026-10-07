// Un identifiant client Stripe stocké en base ne prouve pas que le client
// existe. Il peut venir du mode test (constaté le 07/10/2026 au passage en
// mode réel : la page Provision renvoyait « Le paiement n'a pas pu être
// ouvert » sans dire pourquoi), ou avoir été supprimé dans le tableau de bord.
//
// Ce qui est vérifié ici, c'est la décision prise à partir de la réponse de
// Stripe : réutiliser, recréer, ou laisser remonter l'erreur.
import { describe, expect, it, vi } from "vitest";

const retrieve = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: { customers: { retrieve } },
  stripeConfigured: true,
}));

const { clientStripeExiste } = await import("@/lib/affiliate-billing");

function erreurStripe(code: string) {
  return Object.assign(new Error(`stripe: ${code}`), { code });
}

describe("réutilisation d'un identifiant client Stripe", () => {
  // Pas de `beforeEach(mockReset)` ici : avec Vitest 4, il fait remonter le
  // rejet du test précédent comme erreur non traitée, et les deux cas d'erreur
  // échouent alors qu'ils sont justes. Chaque test pose son implémentation, ce
  // qui suffit à les isoler.
  it("réutilise un client qui existe", async () => {
    retrieve.mockResolvedValue({ id: "cus_1", object: "customer" });
    expect(await clientStripeExiste("cus_1")).toBe(true);
  });

  it("refuse un client supprimé chez Stripe", async () => {
    // Stripe ne lève pas d'erreur pour un client supprimé : il le renvoie
    // avec `deleted: true`. Sans ce cas, on le réutiliserait.
    retrieve.mockResolvedValue({ id: "cus_1", object: "customer", deleted: true });
    expect(await clientStripeExiste("cus_1")).toBe(false);
  });

  it("refuse un identifiant du mode test, inconnu en mode réel", async () => {
    retrieve.mockImplementation(async () => { throw erreurStripe("resource_missing"); });
    expect(await clientStripeExiste("cus_test")).toBe(false);
  });

  it("laisse remonter une panne passagère au lieu de recréer un client", async () => {
    // Le piège : traiter toute erreur comme « client absent » ferait créer un
    // nouveau client à chaque incident réseau, et la marque ressaisirait sa
    // carte à chaque fois sans comprendre.
    retrieve.mockImplementation(async () => { throw erreurStripe("api_connection_error"); });
    await expect(clientStripeExiste("cus_1")).rejects.toThrow();
  });
});
