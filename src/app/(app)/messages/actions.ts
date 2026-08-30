"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { isUuid, type ThreadMessage } from "@/lib/messages";

/**
 * Trouve (ou crée) la conversation entre l'utilisateur courant et `otherUserId`,
 * puis redirige vers le fil. Les rôles brand/creator sont déduits du profil.
 */
export async function openConversation(otherUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (otherUserId === user.id) redirect("/messages");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const brandId = me?.role === "brand" ? user.id : otherUserId;
  const creatorId = me?.role === "brand" ? otherUserId : user.id;

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("brand_id", brandId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  let conversationId = existing?.id;
  if (!conversationId) {
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ brand_id: brandId, creator_id: creatorId })
      .select("id")
      .single();
    if (error || !created) redirect("/messages");
    conversationId = created.id;
  }

  redirect(`/messages/${conversationId}`);
}

/**
 * Envoie un message dans une conversation et remonte la conversation en haut
 * de la liste.
 *
 * `clientId` : identifiant tiré par le navigateur pour son affichage optimiste.
 * On l'impose comme clé primaire du message afin que la copie optimiste, la
 * diffusion temps réel et le rendu serveur portent le même `id` et se fondent
 * en une seule bulle. Un identifiant qui n'est pas un UUID est ignoré : c'est
 * la base qui tranche alors, comme avant.
 */
export async function sendMessage(
  conversationId: string,
  body: string,
  clientId?: string,
): Promise<{ ok: boolean; error?: string; message?: ThreadMessage }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Message vide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({
      ...(clientId && isUuid(clientId) ? { id: clientId } : {}),
      conversation_id: conversationId,
      sender_id: user.id,
      body: trimmed,
    })
    .select("id, sender_id, body, created_at")
    .single();
  if (error) return { ok: false, error: error.message };

  // Remonte la conversation (updated_at) pour le tri de la boîte de réception.
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Notifie le destinataire (avec throttling 15 min pour ne pas spammer
  // sur une vraie conversation).
  const { data: conv } = await supabase
    .from("conversations")
    .select("brand_id, creator_id")
    .eq("id", conversationId)
    .single();
  if (conv) {
    const recipientId = conv.brand_id === user.id ? conv.creator_id : conv.brand_id;
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    const senderName = senderProfile?.display_name ?? "Quelqu'un";
    await notify({
      userId: recipientId,
      type: "message",
      title: `Nouveau message de ${senderName}`,
      body: trimmed.length > 200 ? trimmed.slice(0, 200) + "…" : trimmed,
      link: `/messages/${conversationId}`,
      throttleMinutes: 15,
    });
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { ok: true, message: inserted };
}

/**
 * Marque comme lus les messages entrants d'une conversation.
 *
 * Le rendu serveur du fil le fait déjà à l'ouverture, mais un message qui
 * arrive en temps réel alors que le fil est SOUS LES YEUX de l'utilisateur
 * resterait « non lu » : la pastille de la barre latérale afficherait un
 * message non lu que l'utilisateur est justement en train de lire.
 *
 * La policy RLS `messages_update` (0006) restreint déjà la mise à jour aux
 * membres de la conversation : un identifiant de conversation étranger ne
 * touche aucune ligne.
 */
export async function markConversationRead(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null);

  // La pastille « Messages » vit dans le layout : sans revalidation, elle
  // garderait son compte jusqu'à la prochaine navigation.
  revalidatePath("/messages");
}
