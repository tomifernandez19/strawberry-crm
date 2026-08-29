import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { EchoMessage, InboundMessage } from "./channels/types"
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

  const { count: mensajesPrevios } = await db
    .schema("atencion")
    .from("conversation_messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conversation.id)
  const esPrimerMensaje = (mensajesPrevios ?? 0) === 0

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
    const saludo = esPrimerMensaje ? (customer.nombre ? `¡Hola ${customer.nombre}! ` : "¡Hola! ") : ""
    await programarRespuesta(db, {
      conversationId: conversation.id,
      conversationMessageId: mensajeGuardado.id,
      contenido: `${saludo}${resultado.respuesta}`,
      clasificacion: resultado.clasificacion,
    })
  }

  if (resultado.clasificacion === "desconocido") {
    // Se mandó el mensaje de espera, pero eso solo cumple la promesa si
    // alguien la responde de verdad después — se marca para que no se pierda.
    await setConversationEstado(db, conversation.id, "intervencion_humana")
  }
}

// Cuando alguien responde un DM desde la app del canal directamente (no
// desde la bandeja), Meta avisa con un "eco" en vez de silencio — se
// guarda como respuesta humana real, para que el historial de la bandeja
// quede completo sin importar desde dónde se respondió.
export async function procesarEcoSaliente(db: Db, eco: EchoMessage): Promise<void> {
  if (!eco.contenido) return

  const column =
    eco.canal === "instagram" || eco.canal === "messenger"
      ? { canal: eco.canal, psid: eco.canalThreadId }
      : { canal: "whatsapp" as const, wa_id: eco.canalThreadId }

  const customer = await findOrCreateCustomer(db, column)
  const conversation = await getOrCreateConversation(db, {
    customerId: customer.id,
    canal: eco.canal,
    canalThreadId: eco.canalThreadId,
  })

  await appendMessage(db, {
    conversation_id: conversation.id,
    emisor: "humano",
    contenido: eco.contenido,
    tipo_contenido: "texto",
    canal_message_id: eco.canalMessageId,
    enviado_at: eco.timestamp,
  })

  await setConversationEstado(db, conversation.id, "ia_respondiendo")
}
