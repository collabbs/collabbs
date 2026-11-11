import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Le repli du compteur de tunnel sur la migration 0088.
 *
 * Ce qu'on protège ici n'est pas la mesure du canal — c'est la mesure TOUT
 * COURT. `tracerEtape` avale ses erreurs par conception : « une mesure qui
 * fait échouer ce qu'elle mesure est pire que pas de mesure ». Conséquence
 * directe : si l'insertion échoue parce que la colonne `origine` n'existe pas
 * encore, le tunnel cesse de compter SANS QUE RIEN NE LE DISE.
 *
 * Entre un déploiement du code et l'application de la migration, il y a
 * toujours un intervalle. Ce test dit que l'événement survit à cet
 * intervalle.
 */

const insertions: unknown[] = [];
let echouerSurOrigine = true;

const insert = vi.fn(async (ligne: Record<string, unknown>) => {
  insertions.push(ligne);
  if (echouerSurOrigine && "origine" in ligne) {
    return { error: { message: `column "origine" of relation "tunnel_evenements" does not exist` } };
  }
  return { error: null };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}));

const { tracerEtape } = await import("@/lib/tunnel");

beforeEach(() => {
  insertions.length = 0;
  insert.mockClear();
  echouerSurOrigine = true;
});

describe("tracerEtape — l'événement survit à une colonne absente", () => {
  it("réécrit sans la colonne quand la migration n'est pas passée", async () => {
    await tracerEtape("tunnel_ouvert", "jeton-1", null, "tiktok");

    expect(insert).toHaveBeenCalledTimes(2);
    // Premier essai : avec le canal.
    expect(insertions[0]).toMatchObject({ etape: "tunnel_ouvert", session: "jeton-1", origine: "tiktok" });
    // Second : sans — et c'est celui qui doit aboutir.
    expect(insertions[1]).toMatchObject({ etape: "tunnel_ouvert", session: "jeton-1" });
    expect(insertions[1]).not.toHaveProperty("origine");
  });

  it("n'écrit qu'une fois quand la colonne existe", async () => {
    echouerSurOrigine = false;
    await tracerEtape("defile_ouvert", "jeton-2", "createur", "seo");

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insertions[0]).toMatchObject({ cote: "createur", origine: "seo" });
  });

  it("borne le canal : une valeur hors liste devient null, pas une erreur", async () => {
    echouerSurOrigine = false;
    await tracerEtape("tunnel_ouvert", "jeton-3", null, "<script>alert(1)</script>");

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insertions[0]).toMatchObject({ origine: null });
  });

  it("ne tente rien sans jeton de session", async () => {
    // Navigation privée : on mesure moins, on n'écrit pas de ligne orpheline.
    await tracerEtape("tunnel_ouvert", "", null, "tiktok");
    expect(insert).not.toHaveBeenCalled();
  });
});
