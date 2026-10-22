import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import { formatImage, TYPE_SERVI } from "@/lib/dimensions-image";
import { validerImage, TAILLE_MAX } from "@/lib/image-televersee";

/**
 * Ce qu'on accepte de déposer, et ce qu'on refuse.
 *
 * ─── Ce que ces tests figent ───
 * Les trois dépôts d'image — avatar, visuel de campagne, visuel anonyme — ne
 * regardaient que le type MIME déclaré et l'extension du nom de fichier. Les
 * deux viennent du client. Vérifié le 22/10/2026 sur le projet de
 * développement : un fichier texte de 32 octets déclaré « image/png » était
 * écrit dans un seau PUBLIC sous l'extension de son choix.
 *
 * Le cas qui compte est le SVG. Il passe `type.startsWith("image/")`, et
 * Supabase le sert en `image/svg+xml` — mesuré. Or le SVG est un format ACTIF :
 * ouvert directement dans un onglet, il exécute son script. (`.html`, lui, est
 * neutralisé par Supabase qui le sert en `text/plain` : les deux ont été
 * mesurés, la différence est réelle.)
 *
 * D'où la règle que ces tests gardent : on ne garde que ce qu'on sait
 * reconnaître AUX OCTETS, et c'est le format réel — pas le client — qui décide
 * de l'extension et du type servi.
 */

function bloc(type: string, donnees: Buffer): Buffer {
  const t = Buffer.from(type, "ascii");
  const taille = Buffer.alloc(4);
  taille.writeUInt32BE(donnees.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(Buffer.concat([t, donnees])) : 0);
  return Buffer.concat([taille, t, donnees, crc]);
}

/** Un PNG 1×1 minimal mais authentique. */
function png(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = zlib.deflateSync(Buffer.from([0, 255, 255, 255]));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", ihdr),
    bloc("IDAT", idat),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

const GIF = Buffer.concat([Buffer.from("GIF89a", "ascii"), Buffer.alloc(32)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.alloc(4),
  Buffer.from("WEBPVP8 ", "ascii"),
  Buffer.alloc(32),
]);

const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
  "utf8",
);

function fichier(contenu: Buffer, nom: string, type: string): File {
  return new File([new Uint8Array(contenu)], nom, { type });
}

describe("formatImage — le format vient des octets", () => {
  it("reconnaît les formats qu'on accepte", () => {
    expect(formatImage(new Uint8Array(png()))).toBe("png");
    expect(formatImage(new Uint8Array(GIF))).toBe("gif");
    expect(formatImage(new Uint8Array(JPEG))).toBe("jpg");
    expect(formatImage(new Uint8Array(WEBP))).toBe("webp");
  });

  it("refuse le SVG, quoi qu'en dise le client", () => {
    // Le cœur du défaut : c'est le seul format « image » qui exécute du code.
    expect(formatImage(new Uint8Array(SVG))).toBeNull();
  });

  it("refuse du texte, du HTML et des octets trop courts", () => {
    expect(formatImage(new Uint8Array(Buffer.from("ceci est du texte, pas une image")))).toBeNull();
    expect(formatImage(new Uint8Array(Buffer.from("<h1>bonjour</h1>" + " ".repeat(40))))).toBeNull();
    expect(formatImage(new Uint8Array(Buffer.from([1, 2, 3])))).toBeNull();
  });

  it("donne un type servi pour chaque format accepté", () => {
    expect(TYPE_SERVI.png).toBe("image/png");
    expect(TYPE_SERVI.jpg).toBe("image/jpeg");
    expect(Object.keys(TYPE_SERVI).sort()).toEqual(["avif", "gif", "jpg", "png", "webp"]);
  });
});

describe("validerImage — le contrôle commun aux trois dépôts", () => {
  it("accepte une vraie image et impose l'extension du format réel", async () => {
    // Nom et type MENTEURS : le fichier s'appelle « .svg » et se déclare
    // « image/svg+xml », mais ses octets sont un PNG. C'est le PNG qui gagne.
    const res = await validerImage(fichier(png(), "piege.svg", "image/svg+xml"));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.image.format).toBe("png");
      expect(res.image.ext).toBe("png");
      expect(res.image.type).toBe("image/png");
    }
  });

  it("refuse un texte déguisé en image", async () => {
    const res = await validerImage(
      fichier(Buffer.from("ceci est du texte, pas une image"), "avatar.png", "image/png"),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("pas une image");
  });

  it("refuse un SVG même nommé et déclaré correctement", async () => {
    const res = await validerImage(fichier(SVG, "logo.svg", "image/svg+xml"));
    expect(res.ok).toBe(false);
    // Le message dit POURQUOI : sans ça, quelqu'un qui dépose le logo de sa
    // marque en SVG croit à un bogue.
    if (!res.ok) expect(res.error).toContain("SVG");
  });

  it("refuse le vide, l'absence de fichier et le trop gros", async () => {
    expect((await validerImage(null)).ok).toBe(false);
    expect((await validerImage("pas un fichier")).ok).toBe(false);
    expect((await validerImage(fichier(Buffer.alloc(0), "v.png", "image/png"))).ok).toBe(false);
    const trop = await validerImage(
      fichier(Buffer.alloc(TAILLE_MAX + 1), "gros.png", "image/png"),
    );
    expect(trop.ok).toBe(false);
    if (!trop.ok) expect(trop.error).toContain("5 Mo");
  });
});
