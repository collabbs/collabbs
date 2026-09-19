/* Collabbs — tracker d'affiliation drop-in.
 *
 * Usage côté boutique (2 balises seulement) :
 *
 *   1) Dans le <head> de TOUTES les pages :
 *      <script src="https://collabbs.com/track.js" data-brand="<UUID_marque>"></script>
 *
 *   2) Sur la page de confirmation de commande :
 *      <script>Collabbs.trackSale(MONTANT_TOTAL, "ORDER_ID_UNIQUE");</script>
 *
 * Le script capte automatiquement ?ref=<code> à l'arrivée du visiteur et le
 * garde 30 jours en cookie 1st-party. À la vente, il envoie un pixel signé
 * par le domaine d'origine (le Referer doit correspondre au site enregistré).
 */
(function () {
  "use strict";
  var script =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();
  if (!script) return;

  var brandId = script.getAttribute("data-brand");
  if (!brandId) return;

  var origin;
  try {
    origin = new URL(script.src).origin;
  } catch (_e) {
    return;
  }

  // 1) Capture ?ref dans l'URL et le stocke avec la DATE DU CLIC.
  //
  // La date compte autant que la référence : c'est elle qui permet au serveur
  // d'appliquer la fenêtre d'attribution choisie par la marque. Sans elle,
  // une vente survenue un an après le clic se réglait comme une vente du
  // lendemain.
  //
  // Le cookie garde la durée maximale autorisée (365 jours) et c'est le
  // SERVEUR qui tranche, pas le navigateur. L'inverse — un cookie court —
  // rendrait la fenêtre non configurable : une marque au cycle d'achat long
  // ne pourrait jamais dépasser la durée figée ici.
  //
  // Format : "<ref>|<date ISO>". L'ancien format, une référence nue, reste
  // lisible : les installations existantes continuent de fonctionner, avec le
  // comportement d'avant.
  try {
    var params = new URLSearchParams(window.location.search);
    var ref = params.get("ref");
    if (ref) {
      document.cookie =
        "collabbs_ref=" +
        encodeURIComponent(ref + "|" + new Date().toISOString()) +
        "; max-age=31536000; path=/; SameSite=Lax";
    }
  } catch (_e) {
    /* noop */
  }

  function getCookie(name) {
    var m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m[2]) : null;
  }

  // Sépare la référence de la date. Une valeur sans barre verticale est un
  // cookie posé par l'ancienne version du script : on renvoie la référence et
  // pas de date, ce qui redonne exactement le comportement précédent.
  function lireRef() {
    var brut = getCookie("collabbs_ref");
    if (!brut) return null;
    var i = brut.indexOf("|");
    if (i === -1) return { code: brut, clicke: null };
    return { code: brut.slice(0, i), clicke: brut.slice(i + 1) };
  }

  // 1 bis) Shopify : la référence voyage AVEC la commande.
  //
  // ─── Pourquoi ce détour ───
  // Shopify retire « Additional scripts » de la page de confirmation. Son
  // remplacement, le pixel personnalisé, tourne dans un bac à sable : il ne
  // lit pas les cookies de la boutique, donc il ne peut pas retrouver le
  // `collabbs_ref` posé ici. Le suivi s'arrêterait net au moment précis où il
  // sert.
  //
  // On inscrit donc la référence dans les ATTRIBUTS DU PANIER, côté boutique,
  // là où le cookie est encore lisible. Elle devient une donnée de la commande
  // et n'a plus besoin d'être retrouvée au moment du paiement — le pixel la
  // reçoit dans l'évènement, sans rien avoir à lire.
  //
  // Sans effet ailleurs : la requête n'est tentée que si Shopify est présent.
  function ecrireDansLePanier() {
    try {
      if (!window.Shopify || typeof window.fetch !== "function") return;
      var refPanier = lireRef();
      if (!refPanier) return;
      var attributs = { collabbs_ref: refPanier.code };
      if (refPanier.clicke) attributs.collabbs_clicked_at = refPanier.clicke;
      // `keepalive` pour que l'écriture survive à une navigation immédiate :
      // un visiteur qui ajoute au panier et file au paiement ne doit pas perdre
      // son attribution dans la course.
      window.fetch("/cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributes: attributs }),
        keepalive: true,
      }).catch(function () {
        /* Une boutique sans panier répond parfois en erreur. Ce n'est pas un
           échec du suivi : le cookie reste, et on réessaiera. */
      });
    } catch (_e) {
      /* noop */
    }
  }

  ecrireDansLePanier();

  /* ─── ET SURTOUT : après chaque ajout au panier ────────────────────────────
     Vérifié sur une vraie boutique : en ajoutant le PREMIER article, Shopify
     crée un nouveau panier et jette les attributs posés sur le panier vide.
     La référence disparaissait donc entre l'arrivée du visiteur et sa commande
     — exactement au milieu du parcours qu'on cherche à suivre.

     Les thèmes ajoutent au panier en arrière-plan, sans recharger la page : il
     n'y a donc pas de second chargement pour rattraper. On écoute l'appel
     lui-même, quelle que soit la façon dont le thème le passe. */
  function estUnAjoutAuPanier(url) {
    return typeof url === "string" && url.indexOf("/cart/add") !== -1;
  }

  try {
    var fetchOriginal = window.fetch;
    if (typeof fetchOriginal === "function") {
      window.fetch = function (entree, options) {
        var url = typeof entree === "string" ? entree : (entree && entree.url) || "";
        var promesse = fetchOriginal.apply(this, arguments);
        if (estUnAjoutAuPanier(url)) {
          promesse.then(function () {
            ecrireDansLePanier();
          }).catch(function () {
            /* l'ajout a échoué : rien à réécrire */
          });
        }
        return promesse;
      };
    }
  } catch (_e) {
    /* noop */
  }

  // Les thèmes plus anciens passent encore par XMLHttpRequest.
  try {
    var ouvrirOriginal = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (methode, url) {
      if (estUnAjoutAuPanier(url)) {
        this.addEventListener("load", function () {
          ecrireDansLePanier();
        });
      }
      return ouvrirOriginal.apply(this, arguments);
    };
  } catch (_e) {
    /* noop */
  }

  // 2) API publique : Collabbs.trackSale(amount, orderId).
  window.Collabbs = {
    /**
     * `refExterne` sert au pixel personnalisé de Shopify : il connaît la
     * référence par les attributs de la commande, mais ne peut pas lire le
     * cookie. Sans ce paramètre, il aurait la réponse sans pouvoir s'en servir.
     */
    trackSale: function (amount, orderId, refExterne) {
      var ref = refExterne ? { code: refExterne, clicke: null } : lireRef();
      if (!ref || !ref.code) return; // Pas de clic Collabbs à attribuer.
      var url =
        origin +
        "/api/track/sale-pixel?brand=" +
        encodeURIComponent(brandId) +
        "&ref=" +
        encodeURIComponent(ref.code) +
        (ref.clicke ? "&clicked_at=" + encodeURIComponent(ref.clicke) : "") +
        "&amount=" +
        encodeURIComponent(String(amount)) +
        "&order_id=" +
        encodeURIComponent(String(orderId || ""));
      try {
        var img = new Image();
        img.src = url;
      } catch (_e) {
        /* noop */
      }
    },
  };
})();
