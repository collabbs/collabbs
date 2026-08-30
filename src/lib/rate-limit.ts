import "server-only";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report-error";

/**
 * Limitation de débit des points d'entrée publics.
 *
 * Ce qu'on protège, et de quoi :
 *  - les postbacks (`/api/track/sale`, `/promo`, `/action`) s'authentifient
 *    avec le secret de la marque, donc un secret qu'on peut essayer de
 *    deviner ; sans plafond, le nombre d'essais n'est limité que par ce que
 *    Vercel accepte d'invocations ;
 *  - le pixel et `/r/[code]` n'ont aucune authentification du tout : on peut
 *    fabriquer des clics et des ventes « à confirmer » en boucle ;
 *  - l'authentification : bourrage d'identifiants, énumération de comptes, et
 *    surtout noyade d'une boîte mail sous les courriers de réinitialisation.
 *
 * Le compteur vit en base (`consume_rate_limit`, migration 0049) et non en
 * mémoire : en serverless chaque invocation a sa propre mémoire, un compteur
 * local ne compterait à peu près rien.
 *
 * REPLI PERMISSIF, décision assumée : si la vérification elle-même échoue —
 * base indisponible, fonction absente parce que la migration n'est pas encore
 * passée — on LAISSE PASSER. Une marque qui déclare une vente légitime et se
 * fait refuser, c'est une commission perdue pour un créateur et un client qui
 * appelle ; un attaquant qui passe pendant une panne de base, c'est du bruit
 * dans une fenêtre où de toute façon plus rien ne fonctionne. Le faux négatif
 * est moins cher que le faux positif.
 */

export type RatePolicy = {
  /** Nombre d'appels autorisés par fenêtre. */
  limit: number;
  /** Durée, en secondes, pour reconstituer `limit` jetons. */
  windowSeconds: number;
};

/**
 * Les plafonds. Ils sont réglés pour être invisibles à l'usage normal : ce
 * qu'on veut arrêter, c'est la boucle automatisée, pas la boutique chargée.
 */
export const RATE_POLICIES = {
  /**
   * Postbacks serveur-à-serveur. Une boutique déclare ses ventes au fil de
   * l'eau, rarement plus d'une par seconde ; 120/min lui laisse dix fois la
   * marge. Côté attaquant, ça ramène la recherche du secret de « autant
   * d'essais que la machine en produit » à environ 63 millions par an depuis
   * une IP — hors de portée pour un secret sérieux.
   */
  postback: { limit: 120, windowSeconds: 60 },
  /**
   * Pixel navigateur. La clé porte sur l'IP du VISITEUR, pas sur la boutique :
   * mille acheteurs différents font mille seaux distincts. 60/min par visiteur
   * est très au-dessus d'un parcours d'achat réel.
   */
  pixel: { limit: 60, windowSeconds: 60 },
  /**
   * Redirection d'affiliation. C'est un humain qui clique. 60/min ne gêne
   * personne et coupe le gonflage artificiel de clics.
   */
  redirect: { limit: 60, windowSeconds: 60 },
  /**
   * Formulaires d'authentification. Volontairement bas : dix tentatives par
   * cinq minutes suffisent largement à quelqu'un qui cherche son mot de passe,
   * et rendent le bourrage d'identifiants inopérant.
   */
  auth: { limit: 10, windowSeconds: 300 },
} as const satisfies Record<string, RatePolicy>;

export type BucketState = {
  tokens: number;
  updatedAtMs: number;
};

export type RateVerdict =
  | { allowed: true }
  | { allowed: false; retryAfter: number };

/**
 * Le seau à jetons, en pur calcul — implémentation de RÉFÉRENCE.
 *
 * En production c'est la fonction SQL `consume_rate_limit` qui s'exécute, parce
 * que la décision doit être atomique avec l'écriture du solde. Elle en est la
 * transcription ligne pour ligne ; c'est ici qu'on lit la règle, et ici qu'elle
 * est testée. Les deux doivent bouger ensemble.
 *
 * `state` à `null` = clé jamais vue, seau plein.
 */
export function consume(
  state: BucketState | null,
  policy: RatePolicy,
  nowMs: number,
): { allowed: boolean; state: BucketState } {
  const { limit, windowSeconds } = policy;

  // Politique incohérente : on laisse passer. Une erreur de configuration ne
  // doit pas fermer le service.
  if (limit < 1 || windowSeconds < 1) {
    return { allowed: true, state: { tokens: 0, updatedAtMs: nowMs } };
  }

  const precedent = state ?? { tokens: limit, updatedAtMs: nowMs };

  // Une horloge qui recule ne doit pas créer de jetons : au pire on ne
  // recharge rien.
  const ecoule = Math.max(0, (nowMs - precedent.updatedAtMs) / 1000);
  const jetons = Math.min(limit, precedent.tokens + (ecoule * limit) / windowSeconds);

  if (jetons < 1) {
    // Refusé, et on ne retire rien : celui qui martèle attend que le seau se
    // remplisse, il ne s'enfonce pas. Sinon un script en boucle resterait
    // bloqué bien après avoir été corrigé.
    return { allowed: false, state: { tokens: jetons, updatedAtMs: nowMs } };
  }

  return { allowed: true, state: { tokens: jetons - 1, updatedAtMs: nowMs } };
}

/**
 * Secondes à attendre avant qu'un jeton soit de nouveau disponible.
 * Jamais 0 : un `Retry-After: 0` invite à réessayer immédiatement, ce qui est
 * précisément ce qu'on refuse.
 */
export function retryAfterSeconds(tokens: number, policy: RatePolicy): number {
  if (policy.limit < 1 || policy.windowSeconds < 1) return 1;
  const manquant = Math.max(0, 1 - tokens);
  return Math.max(1, Math.ceil((manquant * policy.windowSeconds) / policy.limit));
}

/**
 * Adresse du client telle que Vercel la transmet.
 *
 * `x-forwarded-for` peut contenir une chaîne de mandataires ; le client réel
 * est en tête. Renvoie `null` quand on ne sait pas qui appelle (développement
 * local, appel interne) : sans identité, mettre tout le monde dans le même
 * seau reviendrait à laisser un seul client bloquer tous les autres.
 */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const tete = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (tete) return tete;
  return headers.get("x-real-ip")?.trim() || null;
}

/**
 * Clé de seau pour une donnée personnelle — typiquement une adresse email.
 *
 * On ne recopie pas l'email en clair dans `rate_limit_buckets` : cette table
 * n'a pas vocation à devenir une liste d'adresses exploitable. Le HMAC compte
 * aussi bien et ne se remonte pas par dictionnaire sans le secret serveur.
 *
 * Sans secret configuré, renvoie `null` — donc pas de limitation sur cette
 * dimension. La limitation par IP reste en place, et ça vaut mieux qu'un
 * fichier d'adresses écrit en clair.
 */
export function identityKey(bucket: string, value: string): string | null {
  const secret = process.env.COLLABBS_POSTBACK_SECRET;
  const propre = value.trim().toLowerCase();
  if (!secret || !propre) return null;
  const empreinte = createHmac("sha256", secret).update(propre).digest("hex").slice(0, 32);
  return `${bucket}:${empreinte}`;
}

/** Réponse 429 normalisée, avec l'en-tête que le client doit respecter. */
export function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Trop de requêtes. Réessaie dans quelques instants.",
      retry_after: retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        // Une réponse de refus mise en cache continuerait de refuser après la
        // fin du blocage.
        "Cache-Control": "no-store",
      },
    },
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Consomme un jeton en base pour cette clé.
 *
 * `key` à `null` (client non identifiable) = pas de limitation : on ne peut
 * pas compter ce qu'on ne sait pas attribuer.
 */
export async function checkRateLimit(
  key: string | null,
  policy: RatePolicy,
): Promise<RateVerdict> {
  if (!key) return { allowed: true };

  try {
    const admin: any = createAdminClient();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: policy.limit,
      p_window_seconds: policy.windowSeconds,
    });

    // Un appel dont on ignorerait l'erreur laisserait la limitation muette :
    // elle n'arrêterait plus rien et personne ne s'en apercevrait.
    if (error) {
      await reportError("rate-limit", error, { detail: `clé ${key}` });
      return { allowed: true };
    }

    // `returns table` arrive sous forme de tableau d'une ligne.
    const ligne = Array.isArray(data) ? data[0] : data;
    if (!ligne || ligne.allowed !== false) return { allowed: true };

    return {
      allowed: false,
      retryAfter: retryAfterSeconds(Number(ligne.tokens_left ?? 0), policy),
    };
  } catch (e) {
    await reportError("rate-limit", e, { detail: `clé ${key}` });
    return { allowed: true };
  }
}

/**
 * Supprime les seaux inactifs.
 *
 * Un seau inactif depuis un jour est forcément plein : la recharge est continue
 * et la plus longue fenêtre se compte en minutes. Le supprimer revient donc
 * exactement à le garder. Sans ce ménage la table grossit d'une ligne par
 * adresse IP jamais revue, indéfiniment.
 *
 * Accroché au cron quotidien existant plutôt qu'à une entrée de plus dans
 * `vercel.json` : c'est du ménage, pas un traitement métier.
 */
export async function purgeRateLimitBuckets(): Promise<number> {
  try {
    const admin: any = createAdminClient();
    const { data, error } = await admin.rpc("purge_rate_limit_buckets");
    if (error) {
      await reportError("rate-limit/purge", error);
      return 0;
    }
    return Number(data ?? 0);
  } catch (e) {
    await reportError("rate-limit/purge", e);
    return 0;
  }
}

/**
 * Limitation par adresse IP pour une route publique.
 * `bucket` sépare les routes entre elles : un pic sur les ventes ne doit pas
 * fermer la porte aux codes promo.
 */
export async function limitByIp(
  request: Request,
  bucket: string,
  policy: RatePolicy,
): Promise<RateVerdict> {
  const ip = clientIp(request.headers);
  return checkRateLimit(ip ? `${bucket}:${ip}` : null, policy);
}
