import { createHmac, timingSafeEqual } from "node:crypto"
import type { ChannelAdapter, InboundMessage, OutboundMessage } from "./types"

// Instagram Messaging corre sobre la misma Messenger Platform que Facebook
// Messenger (confirmado contra la documentación oficial, no asumido) — por
// eso el shape del payload es genérico "page", no específico de Instagram.
const GRAPH_API_VERSION = "v21.0"

interface MessengerWebhookPayload {
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
  }>
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
    const data = payload as MessengerWebhookPayload
    const mensajes: InboundMessage[] = []

    for (const entry of data.entry ?? []) {
      for (const evento of entry.messaging ?? []) {
        if (!evento.message) continue // ignora seen/delivery/postback, solo mensajes reales

        const attachment = evento.message.attachments?.[0]
        mensajes.push({
          canal: "instagram",
          canalThreadId: evento.sender.id,
          canalMessageId: evento.message.mid,
          clienteIdentidad: { psid: evento.sender.id },
          tipoContenido: attachment ? (attachment.type === "image" ? "imagen" : "documento") : "texto",
          contenido: evento.message.text,
          mediaUrl: attachment?.payload.url,
          timestamp: new Date(evento.timestamp).toISOString(),
        })
      }
    }

    return mensajes
  },

  async sendMessage(message: OutboundMessage): Promise<void> {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN
    if (!token) throw new Error("Falta INSTAGRAM_ACCESS_TOKEN")

    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

// Firma HMAC-SHA256 del body crudo, contra el App Secret — evita que
// cualquiera pueda pegarle a este endpoint haciéndose pasar por Meta.
export function verifyInstagramSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  if (!appSecret || !signatureHeader) return false

  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  return a.length === b.length && timingSafeEqual(a, b)
}
