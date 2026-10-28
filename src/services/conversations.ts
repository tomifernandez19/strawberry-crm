import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { avisarEquipo } from "./notifications"

type Db = SupabaseClient<Database>
type Conversation = Database["atencion"]["Tables"]["conversations"]["Row"]
type ConversationMessage = Database["atencion"]["Tables"]["conversation_messages"]["Row"]
type Canal = Conversation["canal"]

const VENTANA_MS = 24 * 60 * 60 * 1000

// Un hilo de Instagram (canal + id de la clienta) puede tener varias
// conversaciones a lo largo del tiempo: una por "caso". Si pasaron más de 24 h
// sin actividad, el próximo mensaje abre una conversación nueva (y cierra la
// vieja). Excepción: si la vieja sigue esperando al equipo, el caso no está
// resuelto y se sigue en la misma. Solo puede haber UNA abierta por hilo (índice
// único parcial), lo que evita duplicados si Meta reintenta un webhook.
export async function getOrCreateConversation(
  db: Db,
  params: { customerId: string; canal: Canal; canalThreadId: string }
): Promise<Conversation> {
  const { data: ultima, error: findError } = await db
    .schema("atencion")
    .from("conversations")
    .select("*")
    .eq("canal", params.canal)
    .eq("canal_thread_id", params.canalThreadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError) throw findError

  if (ultima) {
    const inactiva = Date.now() - new Date(ultima.ultima_interaccion_at).getTime() > VENTANA_MS
    const esperaAlEquipo = ultima.estado === "intervencion_humana" || ultima.estado === "requiere_aprobacion"

    if (!inactiva || esperaAlEquipo) {
      return ultima.estado === "cerrada" ? reabrirConversacion(db, ultima.id) : ultima
    }
    if (ultima.estado !== "cerrada") {
      await db
        .schema("atencion")
        .from("conversations")
        .update({ estado: "cerrada", cerrada_at: new Date().toISOString(), motivo_atencion: null })
        .eq("id", ultima.id)
    }
  }

  const { data: created, error: insertError } = await db
    .schema("atencion")
    .from("conversations")
    .insert({
      customer_id: params.customerId,
      canal: params.canal,
      canal_thread_id: params.canalThreadId,
    })
    .select("*")
    .single()

  if (insertError) {
    // Otro webhook simultáneo ya abrió la conversación (índice único): usar esa.
    if (insertError.code === "23505") {
      const { data: abierta } = await db
        .schema("atencion")
        .from("conversations")
        .select("*")
        .eq("canal", params.canal)
        .eq("canal_thread_id", params.canalThreadId)
        .neq("estado", "cerrada")
        .limit(1)
        .maybeSingle()
      if (abierta) return abierta
    }
    throw insertError
  }
  return created
}

async function reabrirConversacion(db: Db, conversationId: string): Promise<Conversation> {
  const { data, error } = await db
    .schema("atencion")
    .from("conversations")
    .update({ estado: "nueva", cerrada_at: null, ultima_interaccion_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select("*")
    .single()

  if (error) throw error
  return data
}

export async function appendMessage(
  db: Db,
  message: Database["atencion"]["Tables"]["conversation_messages"]["Insert"]
): Promise<ConversationMessage> {
  const { data, error } = await db
    .schema("atencion")
    .from("conversation_messages")
    .insert(message)
    .select("*")
    .single()

  if (error) throw error

  await db
    .schema("atencion")
    .from("conversations")
    .update({ ultima_interaccion_at: new Date().toISOString() })
    .eq("id", message.conversation_id)

  return data
}

export async function setConversationEstado(
  db: Db,
  conversationId: string,
  estado: Conversation["estado"],
  extra?: { nivelConfianza?: 1 | 2 | 3 | null; asignadoA?: string | null; motivoAtencion?: string | null }
): Promise<Conversation> {
  const { data, error } = await db
    .schema("atencion")
    .from("conversations")
    .update({
      estado,
      nivel_confianza_actual: extra?.nivelConfianza,
      asignado_a: extra?.asignadoA,
      // Cualquier cambio de estado limpia el motivo, salvo que se indique uno nuevo.
      motivo_atencion: extra?.motivoAtencion ?? null,
      cerrada_at: estado === "cerrada" ? new Date().toISOString() : null,
    })
    .eq("id", conversationId)
    .select("*")
    .single()

  if (error) throw error

  // Aviso al celular del equipo cada vez que una conversación pasa a esperarlo.
  if (extra?.motivoAtencion && (estado === "intervencion_humana" || estado === "requiere_aprobacion")) {
    const { data: customer } = await db
      .schema("atencion")
      .from("customers")
      .select("nombre")
      .eq("id", data.customer_id)
      .maybeSingle()
    await avisarEquipo(db, {
      conversationId: conversationId,
      titulo: estado === "requiere_aprobacion" ? "Borrador listo para aprobar" : "Una clienta espera al equipo",
      mensaje: `${customer?.nombre ?? "Clienta sin nombre"} · ${data.canal}`,
    })
  }

  return data
}

export async function listConversations(
  db: Db,
  filter?: { estado?: Conversation["estado"]; ultimosDias?: number; excluirCerradas?: boolean; limite?: number }
): Promise<Conversation[]> {
  let query = db
    .schema("atencion")
    .from("conversations")
    .select("*")
    .order("ultima_interaccion_at", { ascending: false })

  if (filter?.estado) query = query.eq("estado", filter.estado)
  if (filter?.excluirCerradas) query = query.neq("estado", "cerrada")
  if (filter?.ultimosDias) {
    query = query.gte("ultima_interaccion_at", new Date(Date.now() - filter.ultimosDias * 86_400_000).toISOString())
  }
  if (filter?.limite) query = query.limit(filter.limite)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function listMessages(db: Db, conversationId: string): Promise<ConversationMessage[]> {
  const { data, error } = await db
    .schema("atencion")
    .from("conversation_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("enviado_at", { ascending: true })

  if (error) throw error
  return data
}

// Cierra las conversaciones sin actividad hace más de `dias` días (incluso si
// quedaron marcadas para el equipo: si pasó una semana, el caso ya se resolvió
// por otro lado o no se va a resolver). No borra nada: siguen en la pestaña
// "Todas", y si la clienta vuelve a escribir se abre una conversación nueva.
export async function cerrarInactivas(db: Db, dias = 7): Promise<number> {
  const limite = new Date(Date.now() - dias * 86_400_000).toISOString()
  const { data, error } = await db
    .schema("atencion")
    .from("conversations")
    .update({ estado: "cerrada", cerrada_at: new Date().toISOString(), motivo_atencion: null })
    .neq("estado", "cerrada")
    .lt("ultima_interaccion_at", limite)
    .select("id")
  if (error) throw error
  return data.length
}
