import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * L'enrobage qui empêche un écran de se verrouiller en silence.
 *
 * Ce qu'on vérifie n'est pas le chemin heureux — il marchait déjà — mais les
 * quatre façons dont un appel peut ne pas répondre, et qui laissaient toutes
 * `busy` à vrai pour toujours, sans message.
 */

const relance = vi.fn();
const estVersionPerimee = vi.fn((_err: unknown) => false);

/* Les deux API de navigation sont remplacées : on teste `tenter`, pas Next.
   Le type exposé par le module déclare `unstable_isUnrecognizedActionError`
   sans argument dans une de ses variantes, d'où le cast — la version que le
   code applicatif appelle, elle, en prend un. */
vi.mock("next/navigation", () => ({
  unstable_rethrow: (err: unknown) => relance(err),
  unstable_isUnrecognizedActionError: ((err: unknown) =>
    estVersionPerimee(err)) as unknown as () => boolean,
}));

const { tenter } = await import("@/lib/tenter");

beforeEach(() => {
  relance.mockReset();
  estVersionPerimee.mockReset().mockReturnValue(false);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("tenter", () => {
  it("rend le résultat tel quel quand l'action répond", async () => {
    expect(await tenter(async () => ({ ok: true }))).toEqual({ ok: true });
    expect(await tenter(async () => ({ ok: false, error: "Trop tôt." }))).toEqual({
      ok: false,
      error: "Trop tôt.",
    });
  });

  it("transforme un appel qui échoue en refus lisible", async () => {
    const r = await tenter(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(r.ok).toBe(false);
    // Le message dit quoi faire, pas « une erreur est survenue ».
    expect(r.error).toContain("réessayer");
    expect(r.error).toContain("connexion");
  });

  it("dit de recharger quand la page est plus vieille que le serveur", async () => {
    estVersionPerimee.mockReturnValue(true);
    const r = await tenter(async () => {
      throw new Error("Unrecognized action");
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Recharge la page");
  });

  it("ne confond pas une action muette avec une réussite", async () => {
    // Un `return` oublié renvoie `undefined` : lire `res.ok` dessus lèverait
    // chez l'appelant, après que `setBusy(false)` a déjà eu lieu ou pas.
    const r = await tenter(async () => undefined as unknown as { ok: boolean; error?: string });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("laisse passer les exceptions par lesquelles Next navigue", async () => {
    /* `redirect()` lève une exception interne. Si on l'avalait, la navigation
       n'aurait pas lieu et l'écran afficherait une erreur à la place.
       `unstable_rethrow` est l'API de cette version de Next pour ça ; on
       vérifie qu'on la consulte, et avec l'erreur reçue. */
    const navigation = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x" });
    relance.mockImplementation((e: unknown) => {
      throw e;
    });
    await expect(
      tenter(async () => {
        throw navigation;
      }),
    ).rejects.toBe(navigation);
    expect(relance).toHaveBeenCalledWith(navigation);
  });

  it("consulte Next AVANT de décider que c'est un échec réseau", async () => {
    // L'ordre compte : un redirect traité comme « connexion coupée »
    // afficherait un message faux sur une action qui a réussi.
    const err = new Error("peu importe");
    await tenter(async () => {
      throw err;
    });
    expect(relance).toHaveBeenCalledWith(err);
  });
});
