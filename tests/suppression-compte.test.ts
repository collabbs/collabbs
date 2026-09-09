import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * On ne quitte pas la table avec l'argent des autres dessus.
 *
 * ─── Ce que ces tests figent ───
 * `deleteAccount` appelait `deleteUser` et rien d'autre. Tout cascade en base :
 * profil → collaborations → transactions → contrats. Or une collaboration a
 * DEUX parties. Un créateur qui partait pendant qu'un séquestre était ouvert
 * effaçait le deal ET la transaction : l'argent restait chez Stripe, la marque
 * n'était jamais remboursée, et il ne restait plus une ligne en base pour
 * rattraper à la main.
 *
 * Ce défaut ne se voit pas en lisant `deleteAccount` — la fonction est courte
 * et fait exactement ce qu'elle annonce. Il se voit en se demandant ce que
 * devient l'AUTRE. C'est cette question-là que les tests ci-dessous posent, à
 * chaque exécution.
 */

const from = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));

/**
 * Un client Supabase minimal : chaque table renvoie les lignes qu'on lui donne.
 * Le maillon est « thenable », comme le vrai constructeur de requête — c'est ce
 * qui permet de l'attendre sans appeler `.single()`.
 */
function base(tables: Record<string, unknown[]>) {
  from.mockImplementation((table: string) => {
    const lignes = tables[table] ?? [];
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self,
      or: self,
      eq: self,
      in: self,
      not: self,
      maybeSingle: async () => ({ data: lignes[0] ?? null, error: null }),
      then: (resoudre: (v: unknown) => unknown) => resoudre({ data: lignes, error: null }),
    });
    return chain;
  });
}

beforeEach(() => vi.clearAllMocks());

const { blocagesAvantSuppression } = await import("@/lib/suppression-compte");
const MOI = "11111111-1111-1111-1111-111111111111";

describe("ce qui empêche un compte de disparaître", () => {
  it("laisse partir un compte qui n'a rien en cours", async () => {
    base({});
    expect(await blocagesAvantSuppression(MOI)).toEqual([]);
  });

  it("retient un compte dont de l'argent est encore sous séquestre", async () => {
    base({ transactions: [{ id: "t1", status: "in_escrow", gross_amount: 1260 }] });
    const b = await blocagesAvantSuppression(MOI);
    expect(b).toHaveLength(1);
    // Le montant est dit : « une somme est immobilisée » ne fait pas
    // comprendre qu'il s'agit de 1 260 €.
    expect(b[0].quoi).toContain("1\u202f260,00€");
    expect(b[0].issue).toMatch(/remboursement|terme/i);
  });

  it("retient aussi quand l'argent est libéré mais pas encore viré", async () => {
    // `released` est le piège : l'écran dit « validé », et pourtant la somme
    // n'a pas quitté la plateforme. C'est l'état exact des 1 260 € bloqués.
    base({ transactions: [{ id: "t1", status: "released", gross_amount: 300 }] });
    expect(await blocagesAvantSuppression(MOI)).toHaveLength(1);
  });

  it("retient un compte engagé dans une collaboration en cours", async () => {
    base({ deals: [{ id: "d1", title: "2 vidéos pour le lancement", status: "active" }] });
    const b = await blocagesAvantSuppression(MOI);
    expect(b[0].quoi).toContain("2 vidéos pour le lancement");
  });

  it("retient un créateur à qui des commissions sont dues", async () => {
    base({
      affiliate_links: [{ id: "l1" }],
      affiliate_events: [
        { id: "e1", status: "validated", commission_amount: 40 },
        { id: "e2", status: "pending", commission_amount: 12.5 },
      ],
    });
    const b = await blocagesAvantSuppression(MOI);
    expect(b[0].quoi).toContain("52,50€");
  });

  it("additionne les raisons plutôt que de s'arrêter à la première", async () => {
    // Sinon on renvoie quelqu'un trois fois de suite, en ne lui donnant qu'un
    // tiers du problème à chaque passage.
    base({
      transactions: [{ id: "t1", status: "in_escrow", gross_amount: 300 }],
      deals: [{ id: "d1", title: "Collab", status: "negotiation" }],
      affiliate_links: [{ id: "l1" }],
      affiliate_events: [{ id: "e1", status: "validated", commission_amount: 40 }],
    });
    expect(await blocagesAvantSuppression(MOI)).toHaveLength(3);
  });

  it("ne retient pas sur une collaboration terminée ni sur une commission déjà versée", async () => {
    // Le filtre est fait par la base (`.in(...)`), donc ce stub renvoie déjà
    // des listes vides : ce test dit que la fonction ne rajoute pas de blocage
    // de son cru quand la base ne lui en donne aucun.
    base({ transactions: [], deals: [], affiliate_links: [{ id: "l1" }], affiliate_events: [] });
    expect(await blocagesAvantSuppression(MOI)).toEqual([]);
  });
});
