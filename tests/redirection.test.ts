import { describe, it, expect } from "vitest";
import { cheminInterne } from "@/lib/redirection";

describe("cheminInterne", () => {
  it("laisse passer un chemin interne", () => {
    expect(cheminInterne("/deals/42")).toBe("/deals/42");
    expect(cheminInterne("/creators?q=sport")).toBe("/creators?q=sport");
  });

  it("retombe sur le défaut quand rien n'est fourni", () => {
    expect(cheminInterne(null)).toBe("/start");
    expect(cheminInterne("")).toBe("/start");
    expect(cheminInterne("   ")).toBe("/start");
    expect(cheminInterne(undefined, "/dashboard")).toBe("/dashboard");
  });

  it("refuse une URL absolue", () => {
    expect(cheminInterne("https://exemple-malveillant.test")).toBe("/start");
    expect(cheminInterne("http://exemple-malveillant.test/x")).toBe("/start");
  });

  it("refuse le protocole-relatif et la barre inversée", () => {
    // Les deux ressortent du site malgré la barre oblique initiale.
    expect(cheminInterne("//exemple-malveillant.test")).toBe("/start");
    expect(cheminInterne("/\\exemple-malveillant.test")).toBe("/start");
  });

  it("refuse un chemin qui ne commence pas par une barre oblique", () => {
    expect(cheminInterne("deals/42")).toBe("/start");
    expect(cheminInterne("javascript:alert(1)")).toBe("/start");
  });
});
