/* Ce que Collabbs a réellement mémorisé, affiché à nu.
 *
 * Sans ça, le test est aveugle : on clique, on achète, et on va voir en base
 * si quelque chose est arrivé. Si rien n'arrive, on ne sait pas à quelle
 * étape ça a lâché — le lien ? le cookie ? le changement de page ? l'envoi ?
 *
 * Ici chaque étape se voit. C'est le seul endroit du dispositif qui explique
 * un échec au lieu de le constater. */
(function () {
  function cookie(nom) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + nom + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function rendre() {
    var boite = document.getElementById("mouchard");
    if (!boite) return;

    // Le tracker écrit `code|date-ISO` — et pas du JSON, comme je l'avais
    // supposé. On lit le vrai format, sinon le mouchard affiche le code collé
    // à l'horodatage et fait douter d'un test qui fonctionne.
    var brut = cookie("collabbs_ref");
    var code = null;
    var pose = null;
    if (brut) {
      var i = brut.indexOf("|");
      code = i === -1 ? brut : brut.slice(0, i);
      pose = i === -1 ? null : brut.slice(i + 1);
    }

    var lignes = [];
    lignes.push(
      code
        ? '<p class="ok">✓ Code créateur mémorisé : <code>' + code + "</code></p>"
        : '<p class="vide">Aucun code mémorisé. Arrive par un lien <code>collabbs.com/r/…</code> pour en poser un.</p>',
    );
    if (pose) {
      lignes.push("<p>Clic enregistré le " + new Date(pose).toLocaleString("fr-FR") + "</p>");
    }
    lignes.push(
      "<p>Cookie lisible sur cette page : <code>" +
        (brut ? "oui" : "non") +
        "</code> · Tracker chargé : <code>" +
        (window.Collabbs ? "oui" : "non") +
        "</code></p>",
    );
    boite.innerHTML = "<h2>Ce que Collabbs voit</h2>" + lignes.join("");
  }

  // Le tracker s'exécute sur le même tour de boucle : on laisse la page finir
  // de se construire avant de lire ce qu'il a posé.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(rendre, 60);
    });
  } else {
    setTimeout(rendre, 60);
  }
})();
