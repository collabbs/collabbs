import { describe, it, expect } from "vitest";
import {
  consume,
  retryAfterSeconds,
  clientIp,
  tooManyRequests,
  RATE_POLICIES,
  type BucketState,
} from "@/lib/rate-limit";

/**
 * Rien ne protégeait les routes publiques : le secret d'une marque pouvait
 * s'essayer en boucle, et le trouver revient à fabriquer des ventes donc à
 * vider une provision. Ces tests figent la règle de décision — celle que la
 * fonction SQL `consume_rate_limit` transcrit — parce qu'elle arbitre entre
 * « bloquer un attaquant » et « bloquer un client qui paie ».
 *
 * On teste le calcul, pas la base : la base n'ajoute que l'atomicité.
 */

const POLICE = { limit: 5, windowSeconds: 10 };
const T0 = 1_700_000_000_000; // instant arbitraire, en millisecondes

/** Rejoue n appels d'affilée, sans laisser le temps se recharger. */
function rafale(n: number, police = POLICE, depart: BucketState | null = null) {
  let etat = depart;
  const verdicts: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const r = consume(etat, police, T0);
    verdicts.push(r.allowed);
    etat = r.state;
  }
  return { verdicts, etat: etat as BucketState };
}

describe("dans le quota", () => {
  it("laisse passer un premier appel, seau jamais vu", () => {
    const r = consume(null, POLICE, T0);
    expect(r.allowed).toBe(true);
    expect(r.state.tokens).toBe(4);
  });

  it("laisse passer exactement `limit` appels d'affilée", () => {
    const { verdicts } = rafale(5);
    expect(verdicts).toEqual([true, true, true, true, true]);
  });
});

describe("hors quota", () => {
  it("refuse l'appel suivant", () => {
    const { verdicts } = rafale(6);
    expect(verdicts[5]).toBe(false);
  });

  it("ne creuse pas la dette de celui qui martèle", () => {
    // Un script en boucle ne doit pas se condamner au-delà de la fenêtre :
    // sinon il resterait bloqué longtemps après avoir été corrigé.
    const { etat } = rafale(200);
    expect(etat.tokens).toBe(0);

    // Une fenêtre entière plus tard, le seau est plein — pas plus creux.
    const apres = consume(etat, POLICE, T0 + 10_000);
    expect(apres.allowed).toBe(true);
    expect(apres.state.tokens).toBe(4);
  });
});

describe("la fenêtre glisse", () => {
  it("rend les jetons au fil du temps, pas d'un bloc", () => {
    const { etat } = rafale(5); // seau vide
    // 5 jetons en 10 s → 1 jeton toutes les 2 s.
    expect(consume(etat, POLICE, T0 + 1_000).allowed).toBe(false);
    expect(consume(etat, POLICE, T0 + 2_000).allowed).toBe(true);
  });

  it("un appel toutes les 2 s passe indéfiniment", () => {
    // Le rythme soutenable est exactement limit/fenêtre : un client régulier
    // ne doit jamais être refusé.
    let etat: BucketState | null = null;
    for (let i = 0; i < 50; i++) {
      const r = consume(etat, POLICE, T0 + i * 2_000);
      expect(r.allowed).toBe(true);
      etat = r.state;
    }
  });

  it("ne laisse pas passer deux fois le quota à cheval sur deux fenêtres", () => {
    // C'est le défaut du compteur remis à zéro à heure fixe : 5 appels en fin
    // de fenêtre + 5 au début de la suivante = 10 en un instant. Le seau ne le
    // permet pas.
    const { etat } = rafale(5);
    const { verdicts } = rafale(5, POLICE, { ...etat, updatedAtMs: T0 - 10_000 });
    // Le seau s'est rechargé de 5 jetons max, donc 5 appels — pas 10.
    expect(verdicts.filter(Boolean)).toHaveLength(5);
    expect(consume(etat, POLICE, T0).allowed).toBe(false);
  });
});

describe("réinitialisation", () => {
  it("revient au seau plein après une fenêtre complète d'inactivité", () => {
    const { etat } = rafale(5);
    const r = consume(etat, POLICE, T0 + 10_000);
    expect(r.state.tokens).toBe(4); // 5 rechargés, 1 consommé
  });

  it("ne dépasse jamais la capacité, même après des heures d'inactivité", () => {
    const { etat } = rafale(5);
    const r = consume(etat, POLICE, T0 + 86_400_000);
    expect(r.state.tokens).toBe(4);
  });

  it("une horloge qui recule ne fabrique pas de jetons", () => {
    const { etat } = rafale(5);
    const r = consume(etat, POLICE, T0 - 60_000);
    expect(r.allowed).toBe(false);
    expect(r.state.tokens).toBe(0);
  });
});

describe("repli permissif", () => {
  it("laisse passer si la politique est incohérente", () => {
    // Une erreur de configuration ne doit pas fermer le service : perdre une
    // vente légitime coûte plus cher que laisser passer un abus.
    expect(consume(null, { limit: 0, windowSeconds: 60 }, T0).allowed).toBe(true);
    expect(consume(null, { limit: 10, windowSeconds: 0 }, T0).allowed).toBe(true);
  });
});

describe("délai avant nouvelle tentative", () => {
  it("annonce le temps réel de recharge d'un jeton", () => {
    // 5 jetons / 10 s → 2 s par jeton.
    expect(retryAfterSeconds(0, POLICE)).toBe(2);
    // Déjà à moitié rechargé : il reste 1 s, arrondie à la seconde supérieure.
    expect(retryAfterSeconds(0.5, POLICE)).toBe(1);
  });

  it("ne dit jamais 0 : ce serait une invitation à recommencer aussitôt", () => {
    expect(retryAfterSeconds(1, POLICE)).toBe(1);
    expect(retryAfterSeconds(5, POLICE)).toBe(1);
  });

  it("arrondit vers le haut, pour ne pas renvoyer un client trop tôt", () => {
    const lent = { limit: 10, windowSeconds: 300 }; // 30 s par jeton
    expect(retryAfterSeconds(0, lent)).toBe(30);
    expect(retryAfterSeconds(0.01, lent)).toBe(30);
  });
});

describe("identification du client", () => {
  it("prend le premier maillon de x-forwarded-for : le client réel", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" });
    expect(clientIp(h)).toBe("1.2.3.4");
  });

  it("retombe sur x-real-ip", () => {
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("renvoie null quand l'appelant est inconnu", () => {
    // Sans identité, mettre tout le monde dans le même seau laisserait un seul
    // client bloquer tous les autres.
    expect(clientIp(new Headers())).toBe(null);
    expect(clientIp(new Headers({ "x-forwarded-for": "  " }))).toBe(null);
  });
});

describe("réponse de refus", () => {
  it("répond 429 avec un Retry-After en secondes", () => {
    const res = tooManyRequests(42);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });

  it("interdit la mise en cache du refus", () => {
    // Un 429 mis en cache continuerait de refuser après la fin du blocage.
    expect(tooManyRequests(3).headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("plafonds retenus", () => {
  it("laisse passer le rythme d'une boutique qui déclare ses ventes", () => {
    // Une vente par seconde pendant cinq minutes : c'est déjà une très grosse
    // boutique, et ça ne doit jamais être refusé.
    let etat: BucketState | null = null;
    for (let i = 0; i < 300; i++) {
      const r = consume(etat, RATE_POLICIES.postback, T0 + i * 1_000);
      expect(r.allowed).toBe(true);
      etat = r.state;
    }
  });

  it("coupe court à la recherche du secret d'une marque", () => {
    // Sans plafond, le nombre d'essais n'est borné que par la machine. Avec
    // celui-ci, une IP plafonne à 120 essais par minute.
    const { verdicts } = rafale(10_000, RATE_POLICIES.postback);
    expect(verdicts.filter(Boolean)).toHaveLength(RATE_POLICIES.postback.limit);
  });
});
