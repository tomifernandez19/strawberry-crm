import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { EchoMessage, InboundMessage } from "./channels/types"
import { findOrCreateCustomer } from "./customers"
import { appendMessage, getOrCreateConversation, setConversationEstado } from "./conversations"
import { getAjustesIa, responderConsulta, type ModoIa } from "./ai-agent"
import { clasificarYResponder, MENSAJE_ESPERA, programarRespuesta } from "./rule-based-responder"

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

  const { modo } = await getAjustesIa(db)
  if (modo !== "apagado") {
    await procesarConIa(db, {
      modo,
      conversation,
      mensajeId: mensajeGuardado.id,
      nombreCliente: customer.nombre,
      esPrimerMensaje,
    })
    return
  }

  const resultado = await clasificarYResponder(db, msg.contenido)

  if (resultado.clasificacion === "reclamo") {
    await setConversationEstado(db, conversation.id, "intervencion_humana")
    return
  }

  if (resultado.clasificacion === "desconocido") {
    if (conversation.estado === "intervencion_humana") {
      // Ya se le avisó una vez y sigue esperando que un humano la atienda
      // (nadie respondió todavía) — no repetir el mensaje de espera en
      // cada mensaje nuevo que mande el cliente mientras tanto.
      return
    }
    const saludo = esPrimerMensaje ? (customer.nombre ? `¡Hola ${customer.nombre}! ` : "¡Hola! ") : ""
    await programarRespuesta(db, {
      conversationId: conversation.id,
      conversationMessageId: mensajeGuardado.id,
      contenido: `${saludo}${resultado.respuesta}`,
      clasificacion: resultado.clasificacion,
    })
    // Se mandó el mensaje de espera, pero eso solo cumple la promesa si
    // alguien la responde de verdad después — se marca para que no se pierda.
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
}

// Camino con Claude (Fase 10). "sombra": deja un borrador en la bandeja para
// que una persona lo apruebe, no manda nada solo. "auto": programa el envío
// como las respuestas por reglas. Ante cualquier duda o error, la
// conversación queda para una persona — nunca se manda algo a ciegas.
async function procesarConIa(
  db: Db,
  params: {
    modo: Exclude<ModoIa, "apagado">
    conversation: { id: string; estado: string }
    mensajeId: string
    nombreCliente: string | null
    esPrimerMensaje: boolean
  }
): Promise<void> {
  const { conversation } = params

  // Ya está marcada para una persona y nadie la atendió todavía: la IA no
  // se mete ni gasta.
  if (conversation.estado === "intervencion_humana") return

  let resultado
  try {
    resultado = await responderConsulta(db, {
      conversationId: conversation.id,
      mensajeId: params.mensajeId,
      nombreCliente: params.nombreCliente,
      esPrimerMensaje: params.esPrimerMensaje,
    })
  } catch (err) {
    console.error("Falló el agente de IA:", err)
    await setConversationEstado(db, conversation.id, "intervencion_humana")
    return
  }

  if (resultado.accion === "sin_respuesta") return

  if (resultado.accion === "derivar") {
    await setConversationEstado(db, conversation.id, "intervencion_humana")
    if (params.modo === "auto" && resultado.motivo !== "equipo_atendiendo") {
      await programarRespuesta(db, {
        conversationId: conversation.id,
        conversationMessageId: params.mensajeId,
        contenido: MENSAJE_ESPERA,
        clasificacion: "desconocido",
      })
    }
    return
  }

  const requiereSeguimiento = resultado.accion === "responder_y_derivar"

  if (params.modo === "auto") {
    await programarRespuesta(db, {
      conversationId: conversation.id,
      conversationMessageId: params.mensajeId,
      contenido: resultado.mensaje,
      clasificacion: "ia",
      fotos: resultado.fotos,
    })
    if (requiereSeguimiento) await setConversationEstado(db, conversation.id, "intervencion_humana")
    return
  }

  // Un mensaje nuevo de la clienta deja viejo el borrador anterior.
  await db
    .schema("atencion")
    .from("borradores_ia")
    .update({ estado: "descartado", resuelto_at: new Date().toISOString() })
    .eq("conversation_id", conversation.id)
    .eq("estado", "pendiente")
  await db.schema("atencion").from("borradores_ia").insert({
    conversation_id: conversation.id,
    conversation_message_id: params.mensajeId,
    ai_run_id: resultado.aiRunId,
    contenido: resultado.mensaje,
    fotos: resultado.fotos,
    requiere_seguimiento: requiereSeguimiento,
  })
  await setConversationEstado(db, conversation.id, requiereSeguimiento ? "intervencion_humana" : "requiere_aprobacion")
}

// Cuando alguien responde un DM desde la app del canal directamente (no
// desde la bandeja), Meta avisa con un "eco" en vez de silencio — se
// guarda como respuesta humana real, para que el historial de la bandeja
// quede completo sin importar desde dónde se respondió.
export async function procesarEcoSaliente(db: Db, eco: EchoMessage): Promise<void> {
  if (!eco.contenido) return

  // Si el mid del eco ya está guardado (lo grabamos nosotros al mandar el
  // mensaje, desde la bandeja o desde el cron), es un eco de nuestro propio
  // envío, no una respuesta humana nueva desde la app de Instagram — se
  // ignora. Si no, se duplica el mensaje en el historial y, peor, se pisa
  // el estado "intervencion_humana" que se acaba de marcar.
  const { data: yaRegistrado } = await db
    .schema("atencion")
    .from("conversation_messages")
    .select("id")
    .eq("canal_message_id", eco.canalMessageId)
    .maybeSingle()
  if (yaRegistrado) return

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
