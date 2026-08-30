import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Une vente déclarée par un navigateur ne doit JAMAIS déclencher de mouvement
 * d'argent avant confirmation de la marque.
 *
 * Contexte — la faille corrigée le 29 août : `/api/track/sale-pixel` acceptait
 * une vente sur la seule foi de l'en-tête `Referer`. Cet en-tête est envoyé par
 * le navigateur, donc falsifiable en une ligne de commande, et tout le reste
 * était public (l'UUID de la marque est écrit dans le `data-brand` du script
 * installé sur sa boutique). N'importe quel créateur inscrit à une campagne
 * pouvait ainsi se créditer des commissions inventées jusqu'à épuiser la
 * provision de la marque.
 *
 * Ces tests figent la barrière. S'ils tombent un jour, c'est que la faille est
 * rouverte.
 */

const reserveCommission = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from, rpc: reserveCommission }),
}));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn(), notifyOnce: vi.fn() }));

/** Construit un client Supabase minimal qui renvoie l'événement demandé. */
function stubEvent(event: Record<string, unknown>) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: self,
    update: self,
    insert: self,
    eq: self,
    in: self,
    maybeSingle: async () => ({ data: event, error: null }),
    single: async () => ({ data: event, error: null }),
    then: undefined,
  });
  from.mockReturnValue(chain);
}

beforeEach(() => {
  vi.clearAllMocks();
  reserveCommission.mockResolvedValue({ data: true, error: null });
});

describe("vente déclarée par le navigateur", () => {
  it("ne réserve aucun argent tant que la marque n'a pas confirmé", async () => {
    const { settleSale } = await import("@/lib/affiliate-billing");
    stubEvent({ id: "evt-1", needs_review: true });

    const status = await settleSale({
      eventId: "evt-1",
      brandId: "brand-1",
      creatorId: "creator-1",
      commission: 50,
      saleAmount: 500,
    });

    expect(status).toBe("unfunded");
    // La barrière tombe AVANT toute écriture : rien n'est réservé, et la
    // décomposition n'est même pas posée.
    expect(reserveCommission).not.toHaveBeenCalled();
  });

  it("la barrière ne gêne pas une vente confirmée ou venue du postback", async () => {
    const { settleSale } = await import("@/lib/affiliate-billing");
    stubEvent({ id: "evt-2", needs_review: false });

    await settleSale({
      eventId: "evt-2",
      brandId: "brand-1",
      creatorId: "creator-1",
      commission: 50,
      saleAmount: 500,
    });

    // Le chemin normal va jusqu'à la réservation sur la provision.
    expect(reserveCommission).toHaveBeenCalled();
  });
});
