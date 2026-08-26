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
  timestamp: string
}

export interface OutboundMessage {
  canalThreadId: string
  contenido: string
}

export interface ChannelAdapter {
  canal: Canal
  verifyWebhook(params: { mode?: string; token?: string; challenge?: string }): string | null
  parseWebhookPayload(payload: unknown): InboundMessage[]
  sendMessage(message: OutboundMessage): Promise<void>
}
