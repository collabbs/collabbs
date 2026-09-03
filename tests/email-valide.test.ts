import { describe, it, expect } from "vitest";
import { emailPlausible, normaliserEmail } from "@/lib/email-valide";

describe("emailPlausible", () => {
  it("accepte les adresses ordinaires", () => {
    expect(emailPlausible("julien@collabbs.com")).toBe(true);
    expect(emailPlausible("marie.dupont@gmail.com")).toBe(true);
  });

  it("accepte ce qu'une regex trop stricte rejetterait à tort", () => {
    // Ces adresses sont valides et se font refuser par la plupart des
    // validations maison. Chaque refus est une personne perdue.
    expect(emailPlausible("julien+collabbs@gmail.com")).toBe(true);
    expect(emailPlausible("o'brien@exemple.fr")).toBe(true);
    expect(emailPlausible("contact@ma-boutique.marketing")).toBe(true);
    expect(emailPlausible("a_b-c.d@sous.domaine.co.uk")).toBe(true);
  });

  it("refuse ce qui ne peut pas être une adresse", () => {
    expect(emailPlausible("")).toBe(false);
    expect(emailPlausible("julien")).toBe(false);
    expect(emailPlausible("julien@")).toBe(false);
    expect(emailPlausible("@collabbs.com")).toBe(false);
    expect(emailPlausible("julien@collabbs")).toBe(false);
    expect(emailPlausible("a@b@c.com")).toBe(false);
    expect(emailPlausible("julien @collabbs.com")).toBe(false);
    expect(emailPlausible("julien@collabbs..com")).toBe(false);
    expect(emailPlausible("julien@collabbs.c")).toBe(false);
    expect(emailPlausible("julien@collabbs.4u")).toBe(false);
  });

  it("refuse les tentatives d'injection dans un en-tête", () => {
    expect(emailPlausible("a@b.com, victime@ailleurs.fr")).toBe(false);
    expect(emailPlausible('"nom" <a@b.com>')).toBe(false);
    expect(emailPlausible("a@b.com\nBcc: x@y.fr")).toBe(false);
  });
});

describe("normaliserEmail", () => {
  it("met en minuscules et enlève les espaces autour", () => {
    expect(normaliserEmail("  Julien@Collabbs.COM ")).toBe("julien@collabbs.com");
  });
});
