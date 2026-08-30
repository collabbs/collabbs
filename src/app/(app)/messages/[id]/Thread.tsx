"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  mergeMessages,
  removeMessage,
  type ThreadMessage,
} from "@/lib/messages";
import { markConversationRead, sendMessage } from "../actions";
import Composer from "./Composer";

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function hourLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Identifiant tiré par le navigateur, pour que la bulle optimiste et la ligne
 * diffusée par le temps réel n'en fassent qu'une (voir `@/lib/messages`).
 * `crypto.randomUUID` exige un contexte sécurisé : hors HTTPS et hors
 * localhost il est absent, on laisse alors la base décider et on renonce à
 * l'affichage optimiste plutôt que d'inventer un identifiant douteux.
 */
function newMessageId(): string | null {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : null;
}

/** Distance au bas du fil en dessous de laquelle on suit les nouveaux messages. */
const STICK_THRESHOLD_PX = 80;

/**
 * Fil de discussion vivant.
 *
 * Le rendu initial reste serveur (`initialMessages`) : si le temps réel ne
 * s'établit pas — publication Postgres non configurée, websocket bloqué par un
 * réseau d'entreprise —, l'écran affiche exactement ce qu'il affichait avant,
 * et l'envoi continue de fonctionner via la Server Action. La dégradation est
 * silencieuse par construction : on n'ajoute rien de bloquant au rendu.
 */
export default function Thread({
  conversationId,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: ThreadMessage[];
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(() =>
    mergeMessages([], initialMessages),
  );

  // Le rendu serveur repasse après chaque `revalidatePath` : on FUSIONNE au
  // lieu de remplacer, sinon un message reçu en temps réel juste avant la
  // revalidation disparaîtrait le temps d'un aller-retour.
  //
  // L'ajustement se fait PENDANT le rendu et non dans un effet : dans un
  // effet, React peint d'abord l'ancienne liste puis la remplace, ce qui
  // provoque un scintillement et un rendu de plus. C'est aussi ce que la
  // règle `react-hooks/set-state-in-effect` demande.
  // ⚠️ La comparaison porte sur une SIGNATURE, pas sur la référence du
  // tableau. Le rendu serveur renvoie un tableau neuf à chaque passage : une
  // comparaison par référence est toujours vraie, ce qui déclenche un
  // `setState` à chaque rendu, donc un rendu de plus, indéfiniment. React
  // abandonne alors l'hydratation et la page devient inerte — le champ de
  // saisie ne répond plus.
  //
  // La signature ne change que quand la liste change vraiment.
  const signature = `${initialMessages.length}:${initialMessages[initialMessages.length - 1]?.id ?? ""}`;
  const [signatureVue, setSignatureVue] = useState(signature);
  if (signature !== signatureVue) {
    setSignatureVue(signature);
    setMessages((prev) => mergeMessages(prev, initialMessages));
  }

  // --- Abonnement temps réel -------------------------------------------------
  useEffect(() => {
    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;

    try {
      client = createClient();
      channel = client
        .channel(`messages:conversation:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const m = payload.new as ThreadMessage;
            setMessages((prev) => mergeMessages(prev, [m]));
            // Le fil est ouvert sous ses yeux : le message est lu d'office.
            if (m.sender_id !== currentUserId) {
              void markConversationRead(conversationId).catch(() => {});
            }
          },
        )
        .subscribe((status, err) => {
          // Sans ce retour, un abonnement refusé était indiscernable d'un
          // abonnement silencieux : la page semblait fonctionner et ne
          // recevait jamais rien. C'est exactement la panne muette que la
          // migration 0050 cherche à éviter — encore fallait-il pouvoir la
          // constater.
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(
              `[messages] abonnement temps réel indisponible (${status})`,
              err ?? "",
            );
          }
        });
    } catch (e) {
      // Variables d'environnement manquantes ou websocket refusé : on retombe
      // sur le comportement d'avant (rechargement), sans casser la page.
      // Mais on le DIT : un échec muet ici se serait traduit par une
      // messagerie qui paraît temps réel et ne l'est pas.
      console.error("[messages] abonnement temps réel impossible", e);
    }

    return () => {
      // Sans ce retrait, chaque navigation vers un fil laisserait un canal
      // ouvert : les abonnements s'accumuleraient et le même message serait
      // traité autant de fois qu'il y a eu de visites.
      if (client && channel) void client.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  // --- Suivi du bas du fil ---------------------------------------------------
  const scrollRef = useRef<HTMLDivElement>(null);
  // On ne recolle au bas que si l'utilisateur y était déjà : le tirer vers le
  // bas pendant qu'il relit d'anciens messages serait pire que ne rien faire.
  const stickToBottom = useRef(true);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // --- Envoi -----------------------------------------------------------------
  const handleSend = useCallback(
    async (text: string) => {
      const localId = newMessageId();
      if (localId) {
        stickToBottom.current = true;
        setMessages((prev) =>
          mergeMessages(prev, [
            {
              id: localId,
              sender_id: currentUserId,
              body: text,
              created_at: new Date().toISOString(),
            },
          ]),
        );
      }

      const res = await sendMessage(conversationId, text, localId ?? undefined);

      if (res.ok) {
        // La ligne renvoyée par la base porte l'horodatage réel : elle
        // remplace la copie optimiste, qui avait l'heure du navigateur.
        if (res.message) setMessages((prev) => mergeMessages(prev, [res.message!]));
        return { ok: true as const };
      }

      if (localId) setMessages((prev) => removeMessage(prev, localId));
      return { ok: false as const, error: res.error };
    },
    [conversationId, currentUserId],
  );

  let lastDay = "";

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex flex-1 flex-col gap-2 overflow-y-auto py-5"
      >
        {messages.length === 0 ? (
          <div className="m-auto text-center">
            <p className="text-sm font-medium text-ink">Démarrez la conversation</p>
            <p className="mt-1 text-sm text-zinc-500">
              Présentez-vous et expliquez votre projet de collaboration.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            const showDay = dayLabel(m.created_at) !== lastDay;
            lastDay = dayLabel(m.created_at);
            return (
              <div key={m.id}>
                {showDay && (
                  <p className="my-3 text-center text-xs font-medium text-zinc-400">
                    {lastDay}
                  </p>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                      mine
                        ? "rounded-br-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                        : "rounded-bl-sm bg-white text-ink ring-1 ring-zinc-100"
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.body}</p>
                    <p
                      className={`mt-1 text-right text-[10px] ${
                        mine ? "text-white/70" : "text-zinc-400"
                      }`}
                    >
                      {hourLabel(m.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="-mx-5 sm:-mx-8">
        <Composer onSend={handleSend} />
      </div>
    </>
  );
}
