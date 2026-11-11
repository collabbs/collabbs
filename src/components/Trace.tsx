"use client";

import { useEffect, useRef } from "react";
import { tracerEtape, type EtapeTunnel } from "@/lib/tunnel";
import { jetonDeSession } from "@/lib/session-tunnel";
import { origineDeSession } from "@/lib/origine";

/**
 * Marque le passage à une étape du tunnel.
 *
 * Ne rend rien, n'attend rien, ne bloque rien. Posé sur un écran, il dit qu'on
 * y est arrivé — c'est tout ce qu'on cherche à savoir.
 */
export default function Trace({
  etape,
  cote,
}: {
  etape: EtapeTunnel;
  cote?: string | null;
}) {
  // Une étape ne se compte qu'une fois par montage : le double rendu du mode
  // strict doublerait sinon chaque chiffre, et une mesure fausse est pire
  // qu'une mesure absente.
  const fait = useRef(false);

  useEffect(() => {
    if (fait.current) return;
    fait.current = true;
    const jeton = jetonDeSession();
    // L'origine est lue au même moment : elle est mémorisée au premier contact
    // et ne change plus, donc chaque étape du tunnel porte le même canal.
    if (jeton) void tracerEtape(etape, jeton, cote, origineDeSession());
  }, [etape, cote]);

  return null;
}
