import { createHmac, timingSafeEqual } from "node:crypto"
import type { ChannelAdapter, EchoMessage, InboundMessage, OutboundMessage, ParsedWebhookPayload } from "./types"

// "Instagram API con Instagram Login" (el flujo que terminó usando esta app,
// no el viejo basado en Página de Facebook) — confirmado contra la
// documentación oficial: endpoints en graph.instagram.com, token de usuario
// de Instagram, sin Página intermedia.
const GRAPH_API_VERSION = "v25.0"

// Formato del payload confirmado contra un mensaje real: el array
// "messaging" (estilo Messenger). Cuando alguien responde un DM desde la
// app de Instagram directamente (no desde nuestra bandeja), Meta también
// manda un aviso de "eco" de ese mismo mensaje para sincronizar entre
// dispositivos — con message.is_echo = true. Si no se filtra, el negocio
// termina apareciendo como si fuera un cliente (visto en producción).
interface InstagramMessage {
  mid: string
  text?: string
  is_echo?: boolean
  attachments?: Array<{ type: string; payload: { url: string } }>
}

interface InstagramWebhookPayload {
  object: string
  entry: Array<{
    id: string
    time: number
    messaging?: Array<{
      sender: { id: string }
      recipient: { id: string }
      timestamp: number
      message?: InstagramMessage
    }>
    changes?: Array<{
      field: string
      value: {
        sender?: { id: string }
        recipient?: { id: string }
        timestamp?: number
        message?: InstagramMessage
      }
    }>
  }>
}

function parseMessagingEvent(evento: {
  sender: { id: string }
  recipient?: { id: string }
  message?: InstagramMessage
  timestamp: number
}): { mensaje?: InboundMessage; eco?: EchoMessage } {
  if (!evento.message) return {}

  if (evento.message.is_echo) {
    // El "cliente" del eco es el destinatario (recipient), no el sender
    // (que acá es el propio negocio) — si no hay recipient, no hay forma
    // de saber a qué conversación pertenece, se descarta.
    if (!evento.recipient) return {}
    return {
      eco: {
        canal: "instagram",
        canalThreadId: evento.recipient.id,
        canalMessageId: evento.message.mid,
        contenido: evento.message.text,
        timestamp: new Date(evento.timestamp).toISOString(),
      },
    }
  }

  const attachment = evento.message.attachments?.[0]
  return {
    mensaje: {
      canal: "instagram",
      canalThreadId: evento.sender.id,
      canalMessageId: evento.message.mid,
      clienteIdentidad: { psid: evento.sender.id },
      tipoContenido: attachment ? (attachment.type === "image" ? "imagen" : "documento") : "texto",
      contenido: evento.message.text,
      mediaUrl: attachment?.payload.url,
      timestamp: new Date(evento.timestamp).toISOString(),
    },
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

  parseWebhookPayload(payload: unknown): ParsedWebhookPayload {
    const data = payload as InstagramWebhookPayload
    const mensajes: InboundMessage[] = []
    const ecos: EchoMessage[] = []

    for (const entry of data.entry ?? []) {
      for (const evento of entry.messaging ?? []) {
        const { mensaje, eco } = parseMessagingEvent(evento)
        if (mensaje) mensajes.push(mensaje)
        if (eco) ecos.push(eco)
      }

      for (const cambio of entry.changes ?? []) {
        if (cambio.field !== "messages" || !cambio.value.sender) continue
        const { mensaje, eco } = parseMessagingEvent({
          sender: cambio.value.sender,
          recipient: cambio.value.recipient,
          message: cambio.value.message,
          timestamp: cambio.value.timestamp ?? Date.now(),
        })
        if (mensaje) mensajes.push(mensaje)
        if (eco) ecos.push(eco)
      }
    }

    return { mensajes, ecos }
  },

  async sendMessage(message: OutboundMessage): Promise<void> {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN
    if (!token) throw new Error("Falta INSTAGRAM_ACCESS_TOKEN")

    // "me" resuelve solo al ID correcto para este token — confirmado
    // probando la API real, porque el ID que muestra el panel de Meta
    // (formato Business Account clásico) no es el mismo que espera este
    // endpoint (formato propio de Instagram Login).
    const response = await fetch(`https://graph.instagram.com/${GRAPH_API_VERSION}/me/messages`, {
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

// El webhook solo manda el PSID del cliente, nunca su nombre — hay que
// pedirlo aparte. Confirmado contra la API real con un cliente de verdad.
export async function fetchInstagramProfile(psid: string): Promise<{ nombre?: string } > {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) return {}

  try {
    const response = await fetch(
      `https://graph.instagram.com/${GRAPH_API_VERSION}/${psid}?fields=name,username&access_token=${token}`
    )
    if (!response.ok) return {}
    const data = (await response.json()) as { name?: string; username?: string }
    return { nombre: data.name ?? data.username }
  } catch {
    return {}
  }
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
