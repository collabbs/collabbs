/**
 * Service worker minimal.
 *
 * Volontairement SANS mise en cache des pages : Collabbs affiche des montants,
 * des statuts de paiement et des messages. Servir une version périmée d'une de
 * ces pages serait pire que ne rien afficher — une marque pourrait croire un
 * séquestre réglé alors qu'il ne l'est pas.
 *
 * Il ne sert donc qu'à deux choses : rendre l'application installable, et
 * afficher une page « hors ligne » lisible au lieu du dinosaure du navigateur.
 */
const CACHE = "collabbs-coquille-v2";
// Fichier statique autonome (styles en ligne) : une page Next mise en cache
// s'afficherait sans style hors ligne, ses fichiers étant justement
// inaccessibles à ce moment-là.
const HORS_LIGNE = "/hors-ligne.html";

self.addEventListener("install", (e) => {
  // L'échec de la mise en cache ne doit PAS faire échouer l'installation :
  // sans ce `catch`, un réseau capricieux à cet instant précis empêcherait le
  // service worker de s'installer, et donc l'application d'être installable.
  // La page de secours plus bas prend le relais si le cache est vide.
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(HORS_LIGNE))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // On efface les caches d'anciennes versions, sinon une page hors-ligne
  // obsolète survivrait aux déploiements.
  e.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Seules les navigations nous intéressent : tout le reste passe au réseau.
  if (req.mode !== "navigate" || req.method !== "GET") return;
  e.respondWith(
    fetch(req).catch(async () => {
      const enCache = await caches.match(HORS_LIGNE);
      if (enCache) return enCache;
      // Dernier recours : le cache est vide (installation partielle). Mieux
      // vaut une phrase que la page d'erreur du navigateur.
      return new Response(
        "<!doctype html><html lang=fr><meta charset=utf-8>" +
          "<meta name=viewport content='width=device-width,initial-scale=1'>" +
          "<title>Hors ligne — Collabbs</title>" +
          "<body style='font-family:-apple-system,sans-serif;text-align:center;padding:15vh 24px;color:#09090b'>" +
          "<h1 style='font-size:24px'>Pas de connexion</h1>" +
          "<p style='color:#71717a'>Reviens dès que tu as du réseau.</p>",
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
      );
    }),
  );
});
