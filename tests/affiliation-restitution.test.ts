import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Une vente remboursée ne doit enrichir personne — Collabbs comprise.
 *
 * ─── Le déséquilibre que ces tests figent ───
 * À la vente, la provision de la marque est débitée de DEUX choses : la
 * commission du créateur, et les frais de Collabbs.
 *
 * Quand le remboursement arrive AVANT le versement, les deux revenaient à la
 * marque — c'était déjà le cas. Quand il arrive APRÈS, on inscrivait une dette
 * au créateur et on ne rendait RIEN : la marque perdait commission et frais,
 * définitivement, et l'écart grandissait à chaque retour produit.
 *
 * La même vente remboursée ne peut pas nous enrichir selon la date à laquelle
 * elle l'est. Les frais reviennent donc tout de suite (ils n'ont jamais quitté
 * Collabbs) et la commission au moment où elle est réellement récupérée sur un
 * versement — pas avant, sinon on la paierait de notre poche.
 */

const from = vi.fn();
// Typé : sans les paramètres, `tsc` voit un tuple vide et `c[0]` ne compile pas.
const rpc = vi.fn(async (_nom: string, _args: Record<string, unknown>) => ({ data: null, error: null }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from, rpc }) }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn(), notifyOnce: vi.fn() }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn(), normalizeMessage: (m: string) => m }));

const VENTE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MARQUE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CREATEUR = "cccccccc-cccc-cccc-cccc-cccccccccccc";

/** Une vente déjà versée au créateur, remboursée ensuite par la marque. */
function baseVenteVersee(commission: number, frais: number) {
  from.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    const lignes =
      table === "affiliate_events"
        ? [{ id: VENTE, status: "paid", commission_amount: commission, platform_fee: frais, link_id: "l1" }]
        : table === "affiliate_links"
          ? [{ id: "l1", creator_id: CREATEUR, campaigns: { brand_id: MARQUE } }]
          : [];
    Object.assign(chain, {
      select: self,
      update: self,
      insert: async () => ({ data: null, error: null }),
      eq: self,
      in: self,
      is: self,
      maybeSingle: async () => ({ data: lignes[0] ?? null, error: null }),
      single: async () => ({ data: lignes[0] ?? null, error: null }),
      // Le verrou de concurrence : la ligne est prise une fois.
      then: (r: (v: unknown) => unknown) => r({ data: [{ id: VENTE }], error: null }),
    });
    return chain;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
});

const { releaseReservation } = await import("@/lib/affiliate-billing");

describe("vente remboursée après versement de la commission", () => {
  it("rend les frais de plateforme à la marque, tout de suite", async () => {
    baseVenteVersee(40, 8);
    const r = await releaseReservation({ eventId: VENTE, status: "refunded" });
    expect(r.ok).toBe(true);

    const credits = rpc.mock.calls.filter((c) => c[0] === "credit_balance");
    expect(credits).toHaveLength(1);
    expect(credits[0]![1]).toMatchObject({
      p_brand: MARQUE,
      p_amount: 8,
      p_kind: "reserve_release",
    });
  });

  it("ne rend PAS la commission tout de suite : elle n'a pas encore été récupérée", async () => {
    // La rendre ici reviendrait à la payer de notre poche : l'argent est chez
    // le créateur, et on n'a pour l'instant qu'une créance sur lui.
    baseVenteVersee(40, 8);
    await releaseReservation({ eventId: VENTE, status: "refunded" });
    const montants = rpc.mock.calls
      .filter((c) => c[0] === "credit_balance")
      .map((c) => (c[1] as unknown as { p_amount: number }).p_amount);
    expect(montants).not.toContain(40);
    expect(montants).not.toContain(48);
  });

  it("ne crédite rien quand il n'y a pas de frais", async () => {
    // `credit_balance` refuse un montant nul ou négatif : l'appeler pour zéro
    // ferait échouer toute la régularisation.
    baseVenteVersee(40, 0);
    const r = await releaseReservation({ eventId: VENTE, status: "refunded" });
    expect(r.ok).toBe(true);
    expect(rpc.mock.calls.filter((c) => c[0] === "credit_balance")).toHaveLength(0);
  });
});
