import "server-only";
import { couleurDominante, decoderPng } from "./couleur-image";

/**
 * Le logo officiel d'une marque, quand son site refuse de nous répondre.
 *
 * ─── Le problème qu'il règle ───
 * Mesuré sur quatorze marques : la moitié bloque toute lecture automatisée.
 * Decathlon et Leroy Merlin répondent 403 à un navigateur complet comme à un
 * service de rendu distant — leur protection est réelle, aucune astuce ne
 * passera. Sephora répond parfois 200, parfois 403 : on ne bâtit rien sur ça.
 *
 * On tombait donc sur le favicon du service de domaines : 16 px pour Sephora,
 * une tache. Julien l'a dit sans détour — « le logo Sephora c'est même pas son
 * logo ». C'était vrai.
 *
 * ─── Pourquoi Wikidata ───
 * Les marques bloquées sont les grandes enseignes. Or ce sont exactement
 * celles qui ont une fiche Wikidata avec leur logo officiel déposé sur
 * Commons. Les petites marques n'y sont pas — mais leur site répond et donne
 * de vraies photos produit. Les deux trous sont complémentaires, ce qui est
 * la raison de faire les deux plutôt que de choisir.
 *
 * Vérifié : Sephora, Decathlon, Leroy Merlin, Nike, Zara, Fnac — six sur six,
 * tous rendus en 960 px de large, avec leurs vraies couleurs.
 *
 * ─── Sur la politesse ───
 * Wikimedia demande qu'on s'identifie, et refuse les agents anonymes. On dit
 * donc qui on est, contrairement aux sites marchands où l'on se présente comme
 * un navigateur (c'est documenté et assumé dans `identite-site`). Rien n'est
 * réhébergé : on garde l'adresse, le navigateur charge l'image.
 */

const AGENT = "Collabbs/1.0 (https://collabbs.com; contact@collabbs.com)";
const DELAI = 6000;

export type LogoOfficiel = {
  /** Adresse d'un rendu PNG large, prêt à être affiché. */
  url: string;
  /** Couleur dominante du logo, ou `null` s'il est monochrome. */
  couleur: string | null;
  /**
   * `true` si les traits du logo sont sombres.
   *
   * Décide comment le poser : un logo noir sur une carte noire est invisible.
   * On ne devine pas — on compte les pixels.
   */
  sombre: boolean;
};

async function json(url: string): Promise<unknown> {
  const r = await fetch(url, {
    headers: { "User-Agent": AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(DELAI),
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/** Le nom enregistrable d'un domaine : `www.decathlon.fr` → `decathlon`. */
export function nomDeDomaine(hote: string): string {
  const parts = hote.replace(/^www\./, "").toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 2] : parts[0];
}

function hoteDe(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export type Revendication = {
  rank?: string;
  mainsnak?: { datavalue?: { value?: unknown } };
  qualifiers?: Record<string, unknown>;
};

/**
 * Cherche les fiches candidates pour un nom de marque.
 *
 * Deux recherches, pas une : la recherche d'entités est exacte sur le libellé
 * et ne trouve pas « Leroy Merlin » à partir de « leroymerlin ». La recherche
 * plein texte, elle, y arrive. Prendre les deux coûte un appel et fait passer
 * la couverture de quatre marques sur six à six sur six.
 */
async function candidats(nom: string): Promise<string[]> {
  const q = encodeURIComponent(nom);
  const ids: string[] = [];
  try {
    const e = (await json(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${q}&language=fr&uselang=fr&format=json&limit=5&type=item`,
    )) as { search?: { id: string }[] };
    ids.push(...(e.search ?? []).map((x) => x.id));
  } catch {
    /* une des deux recherches suffit */
  }
  try {
    const t = (await json(
      `https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=5&format=json`,
    )) as { query?: { search?: { title: string }[] } };
    ids.push(...(t.query?.search ?? []).map((x) => x.title).filter((s) => /^Q\d+$/.test(s)));
  } catch {
    /* idem */
  }
  return [...new Set(ids)].slice(0, 8);
}

/**
 * Choisit la revendication de logo qui vaut aujourd'hui.
 *
 * Wikidata garde les logos historiques : Decathlon en a trois, dont celui de
 * 1976. Le rang « preferred » désigne l'actuel quand il est renseigné ; sinon,
 * une date de FIN (P582) marque un logo révolu, et on écarte ceux-là.
 */
export function logoActuel(revendications: Revendication[]): string | null {
  const prefere = revendications.filter((c) => c.rank === "preferred");
  const encoreEnCours = revendications.filter((c) => !(c.qualifiers ?? {})["P582"]);
  const retenu = (prefere.length ? prefere : encoreEnCours)[0];
  const valeur = retenu?.mainsnak?.datavalue?.value;
  return typeof valeur === "string" && valeur.length > 0 ? valeur : null;
}

/** L'adresse d'un rendu PNG du fichier Commons, à la largeur demandée. */
export function renduCommons(fichier: string, largeur = 512): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fichier)}?width=${largeur}`;
}

/**
 * Le logo officiel d'une marque, à partir de l'adresse de son site.
 *
 * Ne lève jamais : sans réponse, la carte garde son traitement typographique.
 */
export async function logoOfficiel(url: string): Promise<LogoOfficiel | null> {
  const hote = hoteDe(url.startsWith("http") ? url : `https://${url}`);
  if (!hote) return null;
  const nom = nomDeDomaine(hote);
  if (nom.length < 3) return null;

  try {
    const ids = await candidats(nom);
    if (ids.length === 0) return null;

    const fiches = (await json(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join("|")}&props=claims&format=json`,
    )) as { entities?: Record<string, { claims?: Record<string, Revendication[]> }> };

    for (const id of ids) {
      const claims = fiches.entities?.[id]?.claims;
      if (!claims) continue;

      // ⚠️ Le garde-fou : sans lui, « asphalte.com » ramènerait la fiche du
      // revêtement routier. On exige que le SITE OFFICIEL de la fiche porte le
      // même nom de domaine — comparé sur le nom seul, pour que decathlon.com
      // et decathlon.fr se reconnaissent.
      const sites = (claims["P856"] ?? [])
        .map((c) => c.mainsnak?.datavalue?.value)
        .filter((v): v is string => typeof v === "string");
      if (!sites.some((s) => { const h = hoteDe(s); return h !== null && nomDeDomaine(h) === nom; })) {
        continue;
      }

      const fichier = logoActuel(claims["P154"] ?? []);
      if (!fichier) continue;

      const rendu = renduCommons(fichier, 512);
      const image = await fetch(rendu, {
        headers: { "User-Agent": AGENT },
        signal: AbortSignal.timeout(DELAI),
      });
      if (!image.ok) continue;
      const octets = new Uint8Array(await image.arrayBuffer());
      if (octets.length > 2_000_000) continue;

      const teinte = couleurDominante(octets);
      const pixels = decoderPng(octets);

      // Sombre ou clair : on compte les pixels opaques plutôt que de déduire de
      // la couleur dominante, qui ne dit rien d'un logo bicolore.
      let clairs = 0;
      let sombres = 0;
      if (pixels) {
        for (let i = 0; i < pixels.pixels.length; i += 4) {
          if (pixels.pixels[i + 3] < 128) continue;
          const moyenne = (pixels.pixels[i] + pixels.pixels[i + 1] + pixels.pixels[i + 2]) / 3;
          if (moyenne > 128) clairs++;
          else sombres++;
        }
      }

      return {
        url: rendu,
        couleur: teinte?.vive ? teinte.couleur : null,
        sombre: sombres >= clairs,
      };
    }
  } catch {
    /* réseau, quota, format : on n'a simplement pas de logo officiel */
  }
  return null;
}
