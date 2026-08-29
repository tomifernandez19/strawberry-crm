import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { InboundMessage } from "./channels/types"
import { findOrCreateCustomer } from "./customers"
import { appendMessage, getOrCreateConversation, setConversationEstado } from "./conversations"
import { clasificarYResponder, programarRespuesta } from "./rule-based-responder"

type Db = SupabaseClient<Database>

// Punto único de entrada para cualquier mensaje entrante, sin importar el
// canal: guarda el mensaje, y si hay texto, corre el clasificador de
// reglas (sección "sin IA" — Fase 9/10 lite). Reclamos van directo a
// intervención humana; el resto, si matchea algo confiable, se programa
// para salir en 2 minutos (nunca al instante — se siente más real).
export async function procesarMensajeEntrante(
  db: Db,
  msg: InboundMessage,
  nombre?: string
): Promise<void> {
  const column = msg.clienteIdentidad.wa_id
    ? { canal: "whatsapp" as const, wa_id: msg.clienteIdentidad.wa_id, telefono: msg.clienteIdentidad.telefono, nombre }
    : { canal: msg.canal as "instagram" | "messenger", psid: msg.clienteIdentidad.psid!, nombre }

  const customer = await findOrCreateCustomer(db, column)
  const conversation = await getOrCreateConversation(db, {
    customerId: customer.id,
    canal: msg.canal,
    canalThreadId: msg.canalThreadId,
  })
  const mensajeGuardado = await appendMessage(db, {
    conversation_id: conversation.id,
    emisor: "cliente",
    contenido: msg.contenido ?? null,
    tipo_contenido: msg.tipoContenido,
    media_url: msg.mediaUrl ?? null,
    canal_message_id: msg.canalMessageId,
    enviado_at: msg.timestamp,
  })

  if (!msg.contenido) {
    // Audio/imagen sin texto: no hay nada que clasificar. Se marca para
    // que un humano la vea — si no, queda invisible en la bandeja.
    await setConversationEstado(db, conversation.id, "intervencion_humana")
    return
  }

  const resultado = await clasificarYResponder(db, msg.contenido)

  if (resultado.clasificacion === "reclamo") {
    await setConversationEstado(db, conversation.id, "intervencion_humana")
    return
  }

  if (resultado.respuesta) {
    await programarRespuesta(db, {
      conversationId: conversation.id,
      conversationMessageId: mensajeGuardado.id,
      contenido: resultado.respuesta,
      clasificacion: resultado.clasificacion,
    })
  }

  if (resultado.clasificacion === "desconocido") {
    // Se mandó el mensaje de espera, pero eso solo cumple la promesa si
    // alguien la responde de verdad después — se marca para que no se pierda.
    await setConversationEstado(db, conversation.id, "intervencion_humana")
  }
}
