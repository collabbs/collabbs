import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * On ne clôture pas une collaboration qui n'a jamais été payée.
 *
 * ─── Ce que ce test empêche de revenir ───
 * Parcouru en entier le 22/10/2026 sur le projet de développement : la marque
 * propose, le créateur accepte, il dépose ses deux vidéos, la marque les valide
 * et clôture — sans avoir jamais réglé le séquestre. Le deal passait à
 * `completed`.
 *
 * Ce qui le rendait grave, c'est l'après. Le guetteur quotidien a deux
 * passages, et la collaboration sortait des DEUX : celui qui relance les
 * impayés ne regarde que les deals `active`, celui qui reprend les versements
 * exige une transaction en séquestre. Plus aucune relance, plus aucune reprise,
 * jamais.
 *
 * Et le créateur recevait « Collaboration terminée 🎉 … ton versement n'a pas
 * encore pu être effectué ; nous le relançons, tu n'as rien à faire. » On lui
 * demandait d'attendre un virement qui n'existait pas, pour un contenu déjà
 * livré et déjà utilisable.
 *
 * L'exception du montant nul est volontaire et doit tenir elle aussi : une
 * affiliation pure ou un produit offert ne séquestre rien, et le guetteur
 * applique déjà ce même filtre pour ne pas réclamer « Paiement en retard — 0 € ».
 */

const from = vi.fn();
const notify = vi.fn();
const attemptDealPayout = vi.fn(async () => ({ released: true }) as { released: boolean });

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from,
    auth: { getUser: async () => ({ data: { user: { id: MARQUE } } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));
vi.mock("@/lib/deal-payout", () => ({ attemptDealPayout }));
vi.mock("@/lib/notifications", () => ({ notify, notifyOnce: vi.fn() }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn(), normalizeMessage: (m: string) => m }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Map() }));

const DEAL = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MARQUE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CREATEUR = "cccccccc-cccc-cccc-cccc-cccccccccccc";

/**
 * @param montant  le montant de la collaboration
 * @param paiement la transaction de séquestre, ou `null` s'il n'y en a jamais eu
 */
function base(montant: number, paiement: { id: string } | null) {
  from.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    const ligne =
      table === "deals"
        ? { brand_id: MARQUE, creator_id: CREATEUR, status: "active", amount: montant, title: "Deux vidéos" }
        : table === "transactions"
          ? paiement
          : null;
    Object.assign(chain, {
      select: self,
      update: self,
      eq: self,
      in: self,
      single: async () => ({ data: ligne, error: null }),
      maybeSingle: async () => ({ data: ligne, error: null }),
      // Les livrables sont lus sans `single` : tous validés.
      then: (r: (v: unknown) => unknown) =>
        r({ data: table === "deliverables" ? [{ approved: true }, { approved: true }] : [], error: null }),
    });
    return chain;
  });
}

beforeEach(() => vi.clearAllMocks());

describe("completeDeal — la clôture exige un séquestre", () => {
  it("refuse de clôturer une collaboration payante jamais réglée", async () => {
    base(120, null);
    const { completeDeal } = await import("@/app/(app)/deals/actions");
    const res = await completeDeal(DEAL);

    expect(res.ok).toBe(false);
    expect(res.error).toContain("séquestre");
    // Et surtout : on ne prévient PAS le créateur que son versement arrive.
    expect(notify).not.toHaveBeenCalled();
    expect(attemptDealPayout).not.toHaveBeenCalled();
  });

  it("clôture normalement quand le séquestre a été réglé", async () => {
    base(120, { id: "tx1" });
    const { completeDeal } = await import("@/app/(app)/deals/actions");
    const res = await completeDeal(DEAL);

    expect(res.ok).toBe(true);
    expect(attemptDealPayout).toHaveBeenCalledWith(DEAL);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].userId).toBe(CREATEUR);
  });

  it("clôture une collaboration à 0 € sans rien exiger", async () => {
    // Affiliation pure, produit offert : il n'y a rien à séquestrer.
    base(0, null);
    const { completeDeal } = await import("@/app/(app)/deals/actions");
    const res = await completeDeal(DEAL);

    expect(res.ok).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
