"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/** Fenêtre de regroupement : trois messages d'affilée = un seul rafraîchissement. */
const REFRESH_DEBOUNCE_MS = 400;

/**
 * Veille globale sur les messages entrants, montée dans le layout `(app)`.
 *
 * Elle ne rend rien : elle demande à Next de refaire le rendu serveur de la
 * page courante quand un message arrive. C'est ce qui met à jour la pastille
 * « Messages » de la barre latérale et la liste des conversations, où que se
 * trouve l'utilisateur dans l'application — sans dupliquer ici la logique de
 * comptage qui vit déjà dans `fetchSidebarData`.
 *
 * Pas de filtre sur le canal : la RLS de `messages` (policy « messages_select »)
 * est rejouée par Realtime avant chaque diffusion, donc seuls les messages des
 * conversations dont on est partie arrivent jusqu'ici. Filtrer côté client en
 * plus supposerait de connaître la liste de ses conversations et de la tenir à
 * jour — la base le fait déjà mieux.
 */
export default function RealtimeMessages({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      client = createClient();
      channel = client
        .channel(`messages:user:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const sender = (payload.new as { sender_id?: string }).sender_id;
            // Nos propres envois n'ont rien à signaler : ils ne créent pas de
            // non-lu et le fil les affiche déjà.
            if (sender === userId) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
          },
        )
        .subscribe();
    } catch {
      // Temps réel indisponible : la pastille reste mise à jour à la
      // navigation suivante, comme avant.
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
