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

  // 2) API publique : Collabbs.trackSale(amount, orderId).
  window.Collabbs = {
    trackSale: function (amount, orderId) {
      var ref = lireRef();
      if (!ref) return; // Pas de clic Collabbs à attribuer, on ne fait rien.
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
