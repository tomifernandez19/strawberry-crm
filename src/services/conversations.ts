import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type Db = SupabaseClient<Database>
type Conversation = Database["atencion"]["Tables"]["conversations"]["Row"]
type ConversationMessage = Database["atencion"]["Tables"]["conversation_messages"]["Row"]
type Canal = Conversation["canal"]

// (canal, canal_thread_id) es UNIQUE — esto es lo que evita crear una
// conversación duplicada si un webhook llega reintentado.
export async function getOrCreateConversation(
  db: Db,
  params: { customerId: string; canal: Canal; canalThreadId: string }
): Promise<Conversation> {
  const { data: existing, error: findError } = await db
    .schema("atencion")
    .from("conversations")
    .select("*")
    .eq("canal", params.canal)
    .eq("canal_thread_id", params.canalThreadId)
    .maybeSingle()

  if (findError) throw findError
  if (existing) {
    if (existing.estado === "cerrada") {
      return reabrirConversacion(db, existing.id)
    }
    return existing
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

  if (insertError) throw insertError
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
  extra?: { nivelConfianza?: 1 | 2 | 3 | null; asignadoA?: string | null }
): Promise<Conversation> {
  const { data, error } = await db
    .schema("atencion")
    .from("conversations")
    .update({
      estado,
      nivel_confianza_actual: extra?.nivelConfianza,
      asignado_a: extra?.asignadoA,
      cerrada_at: estado === "cerrada" ? new Date().toISOString() : null,
    })
    .eq("id", conversationId)
    .select("*")
    .single()

  if (error) throw error
  return data
}

export async function listConversations(
  db: Db,
  filter?: { estado?: Conversation["estado"] }
): Promise<Conversation[]> {
  let query = db
    .schema("atencion")
    .from("conversations")
    .select("*")
    .order("ultima_interaccion_at", { ascending: false })

  if (filter?.estado) query = query.eq("estado", filter.estado)

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
