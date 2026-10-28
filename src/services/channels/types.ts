// Interfaz común para los adaptadores de canal (sección 12). ConversationService
// y AIAgentService programan contra esto, nunca contra un canal específico.

export type Canal = "whatsapp" | "instagram" | "messenger" | "mercado_libre"

export interface InboundMessage {
  canal: Canal
  canalThreadId: string
  canalMessageId: string
  clienteIdentidad: { wa_id?: string; psid?: string; telefono?: string; nombre?: string }
  tipoContenido: "texto" | "imagen" | "audio" | "documento" | "ubicacion"
  contenido?: string
  mediaUrl?: string
  // Contexto del mensaje: p. ej. la historia nuestra a la que respondió la clienta.
  contexto?: { historia?: { url: string; id?: string }; respuestaA?: unknown }
  timestamp: string
}

// Un mensaje saliente es texto o una imagen (por URL pública), nunca los dos
// a la vez — los canales los mandan como mensajes separados.
export interface OutboundMessage {
  canalThreadId: string
  contenido?: string
  mediaUrl?: string
}

// Cuando alguien responde desde la app del canal directamente (no desde
// la bandeja), algunos canales avisan igual con un "eco" — se guarda como
// mensaje humano, no como si fuera del cliente.
export interface EchoMessage {
  canal: Canal
  canalThreadId: string // el cliente (destinatario del eco), no el negocio
  canalMessageId: string
  contenido?: string
  timestamp: string
}

export interface ParsedWebhookPayload {
  mensajes: InboundMessage[]
  ecos: EchoMessage[]
}

export interface SendMessageResult {
  canalMessageId?: string
}

export interface ChannelAdapter {
  canal: Canal
  verifyWebhook(params: { mode?: string; token?: string; challenge?: string }): string | null
  parseWebhookPayload(payload: unknown): ParsedWebhookPayload
  sendMessage(message: OutboundMessage): Promise<SendMessageResult>
}
