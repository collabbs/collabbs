import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * « Ce qui t'attend ».
 *
 * Ce qui est verrouillé ici, c'est l'ORDRE et le CHOIX de ce qui entre dans la
 * liste. Une liste de tâches qui range mal est pire qu'une absence de liste :
 * elle fait commencer par le mauvais bout. Et une tâche qui n'attend pas
 * d'action du lecteur n'a rien à y faire — c'est une nouvelle, pas une
 * consigne.
 */

/** Table → lignes rendues. Chaque méthode de filtre est ignorée : les tests
 *  fournissent déjà le jeu de lignes attendu pour la table interrogée. */
let donnees: Record<string, unknown[]> = {};

function faireClient() {
  const chaine = (table: string) => {
    const obj: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "not", "is", "order", "limit", "gte", "neq"]) {
      obj[m] = () => obj;
    }
    obj.then = (resoudre: (v: { data: unknown[]; error: null }) => unknown) =>
      resoudre({ data: donnees[table] ?? [], error: null });
    return obj;
  };
  return { from: (t: string) => chaine(t) };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faireClient() }));

const { ceQuiAttend } = await import("@/lib/ce-qui-attend");

const ilYA = (j: number) => new Date(Date.now() - j * 86400000).toISOString();

beforeEach(() => {
  donnees = {};
});

describe("côté marque", () => {
  it("met le séquestre non réglé en premier, et le dit sans détour", async () => {
    donnees = {
      deals: [{ id: "d1", title: "Savon solide", amount: 15, status: "active",
                brand_validated_at: null, brand_validation_deadline_days: 7 }],
      transactions: [],
      deliverables: [],
      contracts: [],
      campaigns: [],
      applications: [],
    };
    const r = await ceQuiAttend("marque-1", "brand");
    expect(r).toHaveLength(1);
    expect(r[0].urgence).toBe("bloque");
    expect(r[0].verbe).toBe("Régler 15,00 €");
    // La phrase dit la CONSÉQUENCE, pas seulement l'état.
    expect(r[0].quoi).toContain("ne commencera pas");
  });

  it("ne réclame rien quand le séquestre est réglé", async () => {
    donnees = {
      deals: [{ id: "d1", title: "Savon", amount: 15, status: "active",
                brand_validated_at: null, brand_validation_deadline_days: 7 }],
      transactions: [{ deal_id: "d1", status: "in_escrow" }],
      deliverables: [], contracts: [], campaigns: [], applications: [],
    };
    expect(await ceQuiAttend("marque-1", "brand")).toHaveLength(0);
  });

  it("réclame la validation d'un livrable déposé, avec le temps restant", async () => {
    donnees = {
      deals: [{ id: "d1", title: "Savon", amount: 15, status: "active",
                brand_validated_at: null, brand_validation_deadline_days: 7 }],
      transactions: [{ deal_id: "d1", status: "in_escrow" }],
      deliverables: [{ id: "l1", deal_id: "d1", label: "Vidéo 1", approved: false,
                       revision_requested: false, submitted_at: ilYA(2) }],
      contracts: [], campaigns: [], applications: [],
    };
    const r = await ceQuiAttend("marque-1", "brand");
    expect(r).toHaveLength(1);
    expect(r[0].verbe).toBe("Valider");
    expect(r[0].echeance?.jours).toBe(5);
    expect(r[0].echeance?.depasse).toBe(false);
  });

  it("signale un délai dépassé plutôt que de l'ignorer", async () => {
    donnees = {
      deals: [{ id: "d1", title: "Savon", amount: 15, status: "active",
                brand_validated_at: null, brand_validation_deadline_days: 7 }],
      transactions: [{ deal_id: "d1", status: "in_escrow" }],
      deliverables: [{ id: "l1", deal_id: "d1", label: "Vidéo 1", approved: false,
                       revision_requested: false, submitted_at: ilYA(10) }],
      contracts: [], campaigns: [], applications: [],
    };
    const r = await ceQuiAttend("marque-1", "brand");
    expect(r[0].echeance?.depasse).toBe(true);
  });

  it("ne réclame pas un livrable déjà validé ni un livrable en reprise", async () => {
    donnees = {
      deals: [{ id: "d1", title: "Savon", amount: 15, status: "active",
                brand_validated_at: null, brand_validation_deadline_days: 7 }],
      transactions: [{ deal_id: "d1", status: "in_escrow" }],
      deliverables: [
        { id: "l1", deal_id: "d1", label: "A", approved: true, revision_requested: false, submitted_at: ilYA(1) },
        { id: "l2", deal_id: "d1", label: "B", approved: false, revision_requested: true, submitted_at: ilYA(1) },
      ],
      contracts: [], campaigns: [], applications: [],
    };
    expect(await ceQuiAttend("marque-1", "brand")).toHaveLength(0);
  });
});

describe("côté créateur", () => {
  it("annonce que l'argent est bloqué et qu'on peut commencer", async () => {
    donnees = {
      deals: [{ id: "d1", title: "Savon", amount: 15, status: "active",
                brand_validated_at: null, brand_validation_deadline_days: 7 }],
      transactions: [{ deal_id: "d1", status: "in_escrow" }],
      deliverables: [{ id: "l1", deal_id: "d1", label: "Vidéo 1", approved: false,
                       revision_requested: false, submitted_at: null }],
      contracts: [], applications: [],
    };
    const r = await ceQuiAttend("createur-1", "creator");
    expect(r).toHaveLength(1);
    expect(r[0].verbe).toBe("Déposer mon contenu");
    expect(r[0].quoi).toContain("bloqué pour toi");
  });

  it("ne dit pas de commencer tant que l'argent n'est pas bloqué", async () => {
    // Le produit ne doit jamais pousser un créateur à travailler sans garantie.
    donnees = {
      deals: [{ id: "d1", title: "Savon", amount: 15, status: "active",
                brand_validated_at: null, brand_validation_deadline_days: 7 }],
      transactions: [],
      deliverables: [{ id: "l1", deal_id: "d1", label: "Vidéo 1", approved: false,
                       revision_requested: false, submitted_at: null }],
      contracts: [], applications: [],
    };
    expect(await ceQuiAttend("createur-1", "creator")).toHaveLength(0);
  });

  it("remonte une reprise demandée", async () => {
    donnees = {
      deals: [{ id: "d1", title: "Savon", amount: 15, status: "active",
                brand_validated_at: null, brand_validation_deadline_days: 7 }],
      transactions: [{ deal_id: "d1", status: "in_escrow" }],
      deliverables: [{ id: "l1", deal_id: "d1", label: "Vidéo 1", approved: false,
                       revision_requested: true, submitted_at: ilYA(1) }],
      contracts: [], applications: [],
    };
    const r = await ceQuiAttend("createur-1", "creator");
    expect(r.some((x) => x.verbe === "Voir ce qui est demandé")).toBe(true);
  });
});

describe("l'ordre de la liste", () => {
  it("ce qui bloque passe devant, puis l'échéance la plus proche", async () => {
    donnees = {
      deals: [
        { id: "d1", title: "A", amount: 15, status: "active", brand_validated_at: null, brand_validation_deadline_days: 7 },
        { id: "d2", title: "B", amount: 30, status: "active", brand_validated_at: null, brand_validation_deadline_days: 7 },
      ],
      transactions: [{ deal_id: "d2", status: "in_escrow" }],
      deliverables: [
        { id: "l1", deal_id: "d2", label: "Loin", approved: false, revision_requested: false, submitted_at: ilYA(1) },
        { id: "l2", deal_id: "d2", label: "Proche", approved: false, revision_requested: false, submitted_at: ilYA(6) },
      ],
      contracts: [], campaigns: [], applications: [],
    };
    const r = await ceQuiAttend("marque-1", "brand");
    expect(r[0].urgence).toBe("bloque");            // le séquestre de « A »
    expect(r[1].quoi).toContain("Proche");           // 1 jour restant
    expect(r[2].quoi).toContain("Loin");             // 6 jours restants
  });

  it("rend une liste vide quand la balle est dans l'autre camp", async () => {
    donnees = { deals: [], transactions: [], deliverables: [], contracts: [], campaigns: [], applications: [] };
    expect(await ceQuiAttend("marque-1", "brand")).toEqual([]);
  });
});
