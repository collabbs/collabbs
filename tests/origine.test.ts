import { describe, expect, it } from "vitest";
import { CANAUX, canalDepuis, estUnCanal } from "@/lib/origine";

/**
 * Le canal d'arrivée.
 *
 * Ce qui compte ici n'est pas de reconnaître « tiktok » — c'est de REFUSER
 * tout le reste. `utm_source` vient de l'URL, donc de n'importe qui : sans
 * borne, le premier robot qui passe avec une chaîne fantaisiste s'inscrit
 * dans la mesure, et il suffit d'une poignée de visites bizarres pour qu'un
 * tableau hebdomadaire devienne illisible.
 */

describe("estUnCanal — la liste est fermée", () => {
  it("accepte les six canaux du plan de sortie", () => {
    for (const c of CANAUX) expect(estUnCanal(c)).toBe(true);
    expect(CANAUX).toHaveLength(6);
  });

  it("refuse tout le reste, y compris ce qui ressemble", () => {
    for (const faux of [
      "TikTok", "tik-tok", "tiktok ", " tiktok", "facebook", "google-ads",
      "<script>alert(1)</script>", "'; drop table profiles; --",
      "", "null", "direct", "a".repeat(500),
    ]) {
      expect(estUnCanal(faux), `« ${faux.slice(0, 24)} »`).toBe(false);
    }
  });

  it("refuse ce qui n'est pas une chaîne", () => {
    for (const faux of [null, undefined, 42, {}, [], true]) {
      expect(estUnCanal(faux)).toBe(false);
    }
  });
});

describe("canalDepuis — l'URL gagne sur le référent", () => {
  it("lit utm_source quand il est dans la liste", () => {
    expect(canalDepuis("?utm_source=tiktok", "")).toBe("tiktok");
    expect(canalDepuis("utm_source=createurs", "")).toBe("createurs");
    expect(canalDepuis("?a=1&utm_source=eleves&b=2", "")).toBe("eleves");
  });

  it("ignore un utm_source hors liste plutôt que de l'enregistrer", () => {
    expect(canalDepuis("?utm_source=facebook", "")).toBeNull();
    expect(canalDepuis("?utm_source=<script>", "")).toBeNull();
  });

  it("préfère l'URL au référent, même si le référent dit autre chose", () => {
    // Un lien TikTok cliqué depuis les résultats Google reste attribué à
    // TikTok : c'est nous qui avons écrit l'étiquette dans le lien.
    expect(canalDepuis("?utm_source=tiktok", "https://www.google.com/search?q=x")).toBe("tiktok");
  });

  it("déduit le référencement d'une arrivée par un moteur", () => {
    for (const ref of [
      "https://www.google.com/search?q=contrat+influenceur",
      "https://www.google.fr/",
      "https://duckduckgo.com/",
      "https://www.bing.com/search?q=ugc",
      "https://lite.qwant.com/",
    ]) {
      expect(canalDepuis("", ref), ref).toBe("seo");
    }
  });

  it("ne compte pas un retour depuis notre propre site", () => {
    // Sinon chaque navigation interne réécrirait l'origine.
    expect(canalDepuis("", "https://collabbs.com/defile")).toBeNull();
    expect(canalDepuis("", "https://www.collabbs.com/blog")).toBeNull();
  });

  it("ne devine rien d'un référent inconnu ou illisible", () => {
    expect(canalDepuis("", "https://un-blog-quelconque.fr/article")).toBeNull();
    expect(canalDepuis("", "pas une url")).toBeNull();
    expect(canalDepuis("", "")).toBeNull();
  });

  it("une arrivée directe renvoie null, et c'est une réponse", () => {
    // « Personne ne nous a amenés » est une information du test, pas un échec.
    expect(canalDepuis("", "")).toBeNull();
  });
});
