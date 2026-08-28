import { createHmac, timingSafeEqual } from "node:crypto"
import type { ChannelAdapter, InboundMessage, OutboundMessage } from "./types"

// "Instagram API con Instagram Login" (el flujo que terminó usando esta app,
// no el viejo basado en Página de Facebook) — confirmado contra la
// documentación oficial: endpoints en graph.instagram.com, token de usuario
// de Instagram, sin Página intermedia.
const GRAPH_API_VERSION = "v25.0"

// La forma exacta del payload de webhook para este flujo no está del todo
// clara en la documentación pública (hay indicios de un formato "messaging"
// como Messenger, y de un formato "changes" como otros webhooks de
// Instagram). Se soportan ambos acá; queda confirmarlo con el primer
// mensaje real una vez conectado el webhook de verdad.
interface InstagramWebhookPayload {
  object: string
  entry: Array<{
    id: string
    time: number
    messaging?: Array<{
      sender: { id: string }
      recipient: { id: string }
      timestamp: number
      message?: { mid: string; text?: string; attachments?: Array<{ type: string; payload: { url: string } }> }
    }>
    changes?: Array<{
      field: string
      value: {
        sender?: { id: string }
        recipient?: { id: string }
        timestamp?: number
        message?: { mid: string; text?: string; attachments?: Array<{ type: string; payload: { url: string } }> }
      }
    }>
  }>
}

function parseMessagingEvent(evento: {
  sender: { id: string }
  message?: { mid: string; text?: string; attachments?: Array<{ type: string; payload: { url: string } }> }
  timestamp: number
}): InboundMessage | null {
  if (!evento.message) return null
  const attachment = evento.message.attachments?.[0]
  return {
    canal: "instagram",
    canalThreadId: evento.sender.id,
    canalMessageId: evento.message.mid,
    clienteIdentidad: { psid: evento.sender.id },
    tipoContenido: attachment ? (attachment.type === "image" ? "imagen" : "documento") : "texto",
    contenido: evento.message.text,
    mediaUrl: attachment?.payload.url,
    timestamp: new Date(evento.timestamp).toISOString(),
  }
}

export const instagramAdapter: ChannelAdapter = {
  canal: "instagram",

  verifyWebhook({ mode, token, challenge }) {
    const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
    if (mode === "subscribe" && token && expected && token === expected) {
      return challenge ?? null
    }
    return null
  },

  parseWebhookPayload(payload: unknown): InboundMessage[] {
    const data = payload as InstagramWebhookPayload
    const mensajes: InboundMessage[] = []

    for (const entry of data.entry ?? []) {
      for (const evento of entry.messaging ?? []) {
        const parsed = parseMessagingEvent(evento)
        if (parsed) mensajes.push(parsed)
      }

      for (const cambio of entry.changes ?? []) {
        if (cambio.field !== "messages" || !cambio.value.sender) continue
        const parsed = parseMessagingEvent({
          sender: cambio.value.sender,
          message: cambio.value.message,
          timestamp: cambio.value.timestamp ?? Date.now(),
        })
        if (parsed) mensajes.push(parsed)
      }
    }

    return mensajes
  },

  async sendMessage(message: OutboundMessage): Promise<void> {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN
    const igId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
    if (!token) throw new Error("Falta INSTAGRAM_ACCESS_TOKEN")
    if (!igId) throw new Error("Falta INSTAGRAM_BUSINESS_ACCOUNT_ID")

    const response = await fetch(`https://graph.instagram.com/${GRAPH_API_VERSION}/${igId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        recipient: { id: message.canalThreadId },
        message: { text: message.contenido },
      }),
    })

    if (!response.ok) {
      throw new Error(`Instagram sendMessage falló (${response.status}): ${await response.text()}`)
    }
  },
}

// Firma HMAC-SHA256 del body crudo, contra el App Secret de Instagram (el
// que aparece en Instagram > API setup with Instagram login — es distinto
// del App Secret general de la app). Evita que cualquiera le pegue a este
// endpoint haciéndose pasar por Meta.
export function verifyInstagramSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  if (!appSecret || !signatureHeader) return false

  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  return a.length === b.length && timingSafeEqual(a, b)
}
