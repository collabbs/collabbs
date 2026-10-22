import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Un affilié qui arrive sans que la marque l'apprenne.
 *
 * ─── Ce que ces tests figent ───
 * Il y a deux portes pour devenir affilié : la page des opportunités, et le
 * lien public `/c/<campagne>` qu'une marque diffuse pour recruter. Seule la
 * première prévenait la marque. Un créateur arrivé par la seconde — celle du
 * recrutement, donc la plus fréquente — devenait affilié en silence : la
 * marque découvrait son existence le jour d'une vente, sans savoir d'où elle
 * venait.
 *
 * L'avis part maintenant de `creerLienAffilie`, avec la création du lien, pour
 * la même raison que le code promo : les deux portes passent par là, et ce qui
 * accompagne la naissance d'un lien n'a pas à être réécrit par chaque
 * appelant. Ces tests vérifient donc les deux bornes qui comptent — une fois
 * pour un lien neuf, jamais pour un lien qui existait déjà.
 */

const from = vi.fn();
const notify = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));
vi.mock("@/lib/notifications", () => ({ notify, notifyOnce: vi.fn() }));

const CAMPAGNE = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const MARQUE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CREATEUR = "cccccccc-cccc-cccc-cccc-cccccccccccc";

/** @param lienExistant la ligne rendue par la recherche de lien déjà posé. */
function base(lienExistant: { code: string } | null) {
  from.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    const ligne =
      table === "affiliate_links"
        ? lienExistant
        : table === "campaigns"
          ? {
              id: CAMPAGNE,
              status: "active",
              with_promo_code: false,
              promo_code: null,
              brand_id: MARQUE,
              name: "Affiliation savon",
            }
          : table === "profiles"
            ? { display_name: "Tom Vasseur" }
            : null;
    Object.assign(chain, {
      select: self,
      eq: self,
      insert: async () => ({ error: null }),
      maybeSingle: async () => ({ data: ligne, error: null }),
    });
    return chain;
  });
}

beforeEach(() => vi.clearAllMocks());

describe("creerLienAffilie — l'avis à la marque", () => {
  it("prévient la marque une seule fois pour un lien neuf", async () => {
    base(null);
    const { creerLienAffilie } = await import("@/lib/lien-affilie");
    const res = await creerLienAffilie(CREATEUR, CAMPAGNE);

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.existait).toBe(false);
    expect(notify).toHaveBeenCalledTimes(1);
    const avis = notify.mock.calls[0][0];
    expect(avis.userId).toBe(MARQUE);
    expect(avis.type).toBe("affiliate_joined");
    // Le nom du créateur et celui de la campagne : sans eux la marque reçoit
    // « un créateur a rejoint une campagne » et doit aller chercher qui et où.
    expect(avis.title).toContain("Tom Vasseur");
    expect(avis.title).toContain("Affiliation savon");
    expect(avis.link).toBe(`/campaigns/${CAMPAGNE}`);
  });

  it("ne prévient personne quand le lien existait déjà", async () => {
    // Le créateur qui recharge la page publique, ou revient dessus un mois
    // plus tard. Sans cette borne, la marque reçoit le même avis en boucle et
    // finit par ne plus lire aucune notification.
    base({ code: "dejapose01" });
    const { creerLienAffilie } = await import("@/lib/lien-affilie");
    const res = await creerLienAffilie(CREATEUR, CAMPAGNE);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.existait).toBe(true);
      expect(res.code).toBe("dejapose01");
    }
    expect(notify).not.toHaveBeenCalled();
  });
});
