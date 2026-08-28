import { createServiceClient } from "@/lib/supabase/server"
import { instagramAdapter, verifyInstagramSignature } from "@/services/channels/instagram"
import { findOrCreateCustomer } from "@/services/customers"
import { appendMessage, getOrCreateConversation } from "@/services/conversations"

// Handshake de verificación: Meta lo llama una vez al configurar el webhook.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const challenge = instagramAdapter.verifyWebhook({
    mode: url.searchParams.get("hub.mode") ?? undefined,
    token: url.searchParams.get("hub.verify_token") ?? undefined,
    challenge: url.searchParams.get("hub.challenge") ?? undefined,
  })

  if (!challenge) return new Response("Forbidden", { status: 403 })
  return new Response(challenge, { status: 200 })
}

// Mensajes entrantes reales. Sin agente de IA todavía (Fase 10) — cada
// mensaje nuevo queda esperando en la bandeja para que lo respondas vos.
export async function POST(request: Request) {
  const rawBody = await request.text()

  if (!verifyInstagramSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 403 })
  }

  const payload = JSON.parse(rawBody)
  const mensajes = instagramAdapter.parseWebhookPayload(payload)
  const db = createServiceClient()

  for (const msg of mensajes) {
    const customer = await findOrCreateCustomer(db, { canal: "instagram", psid: msg.clienteIdentidad.psid! })
    const conversation = await getOrCreateConversation(db, {
      customerId: customer.id,
      canal: "instagram",
      canalThreadId: msg.canalThreadId,
    })
    await appendMessage(db, {
      conversation_id: conversation.id,
      emisor: "cliente",
      contenido: msg.contenido ?? null,
      tipo_contenido: msg.tipoContenido,
      media_url: msg.mediaUrl ?? null,
      canal_message_id: msg.canalMessageId,
      enviado_at: msg.timestamp,
    })
  }

  // Meta reintenta si no devolvemos 200 rápido.
  return new Response("EVENT_RECEIVED", { status: 200 })
}
