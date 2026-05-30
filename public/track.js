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

  // 1) Capture ?ref dans l'URL et stocke 30 jours.
  try {
    var params = new URLSearchParams(window.location.search);
    var ref = params.get("ref");
    if (ref) {
      document.cookie =
        "collabbs_ref=" +
        encodeURIComponent(ref) +
        "; max-age=2592000; path=/; SameSite=Lax";
    }
  } catch (_e) {
    /* noop */
  }

  function getCookie(name) {
    var m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m[2]) : null;
  }

  // 2) API publique : Collabbs.trackSale(amount, orderId).
  window.Collabbs = {
    trackSale: function (amount, orderId) {
      var ref = getCookie("collabbs_ref");
      if (!ref) return; // Pas de clic Collabbs à attribuer, on ne fait rien.
      var url =
        origin +
        "/api/track/sale-pixel?brand=" +
        encodeURIComponent(brandId) +
        "&ref=" +
        encodeURIComponent(ref) +
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
