import { describe, it, expect } from "vitest";
import { estAdresseInterne } from "@/lib/url-publique";

describe("adresses qu'on ne doit jamais joindre", () => {
  it("refuse la boucle locale", () => {
    expect(estAdresseInterne("127.0.0.1")).toBe(true);
    expect(estAdresseInterne("127.255.255.254")).toBe(true);
    expect(estAdresseInterne("::1")).toBe(true);
  });

  it("refuse l'adresse de métadonnées des hébergeurs cloud", () => {
    // La cible classique d'un SSRF : elle sert les identifiants de la machine.
    expect(estAdresseInterne("169.254.169.254")).toBe(true);
  });

  it("refuse les trois plages privées", () => {
    expect(estAdresseInterne("10.0.0.1")).toBe(true);
    expect(estAdresseInterne("172.16.0.1")).toBe(true);
    expect(estAdresseInterne("172.31.255.255")).toBe(true);
    expect(estAdresseInterne("192.168.1.1")).toBe(true);
  });

  it("laisse passer ce qui borde les plages privées sans y être", () => {
    expect(estAdresseInterne("172.15.0.1")).toBe(false);
    expect(estAdresseInterne("172.32.0.1")).toBe(false);
    expect(estAdresseInterne("192.167.1.1")).toBe(false);
    expect(estAdresseInterne("11.0.0.1")).toBe(false);
  });

  it("refuse l'adresse « cette machine » et le CGNAT", () => {
    expect(estAdresseInterne("0.0.0.0")).toBe(true);
    expect(estAdresseInterne("100.64.0.1")).toBe(true);
  });

  it("refuse le lien-local et l'unique-local IPv6", () => {
    expect(estAdresseInterne("fe80::1")).toBe(true);
    expect(estAdresseInterne("fc00::1")).toBe(true);
    expect(estAdresseInterne("fd12:3456::1")).toBe(true);
  });

  it("n'est pas dupe d'une IPv4 déguisée en IPv6", () => {
    // Le contournement le plus courant des filtres écrits à la va-vite.
    expect(estAdresseInterne("::ffff:127.0.0.1")).toBe(true);
    expect(estAdresseInterne("::ffff:169.254.169.254")).toBe(true);
    expect(estAdresseInterne("::ffff:8.8.8.8")).toBe(false);
  });

  it("laisse passer les adresses publiques", () => {
    expect(estAdresseInterne("8.8.8.8")).toBe(false);
    expect(estAdresseInterne("1.1.1.1")).toBe(false);
    expect(estAdresseInterne("2606:4700::1")).toBe(false);
  });
});
