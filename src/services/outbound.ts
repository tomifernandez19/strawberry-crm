import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { Canal } from "./channels/types"
import { getChannelAdapter } from "./channels/registry"
import { appendMessage } from "./conversations"

type Db = SupabaseClient<Database>

// Envía texto + fotos por el canal real y recién después deja el registro en
// el historial, guardando el id que asigna el canal — así el "eco" que Meta
// manda de vuelta se reconoce como propio (ver procesarEcoSaliente).
// Si el texto falla, tira el error y no registra nada: quien llama decide
// qué hacer (un borrador queda pendiente para reintentar). Si fallan solo
// las fotos, el texto ya salió: se devuelve un aviso en vez de tirar.
export async function enviarRespuesta(
  db: Db,
  params: {
    conversationId: string
    contenido: string
    fotos?: string[]
    emisor: "ia" | "humano"
    autorId?: string | null
    aiRunId?: string | null
  }
): Promise<{ fotosFallidas: number }> {
  const { data: conversation, error } = await db
    .schema("atencion")
    .from("conversations")
    .select("canal, canal_thread_id")
    .eq("id", params.conversationId)
    .single()
  if (error) throw error

  const adapter = getChannelAdapter(conversation.canal as Canal)
  const canalThreadId = conversation.canal_thread_id ?? ""

  const envioTexto = await adapter.sendMessage({ canalThreadId, contenido: params.contenido })
  await appendMessage(db, {
    conversation_id: params.conversationId,
    emisor: params.emisor,
    autor_id: params.autorId ?? null,
    ai_run_id: params.aiRunId ?? null,
    contenido: params.contenido,
    tipo_contenido: "texto",
    canal_message_id: envioTexto.canalMessageId ?? null,
  })

  let fotosFallidas = 0
  for (const url of params.fotos ?? []) {
    try {
      const envioFoto = await adapter.sendMessage({ canalThreadId, mediaUrl: url })
      await appendMessage(db, {
        conversation_id: params.conversationId,
        emisor: params.emisor,
        autor_id: params.autorId ?? null,
        ai_run_id: params.aiRunId ?? null,
        tipo_contenido: "imagen",
        media_url: url,
        canal_message_id: envioFoto.canalMessageId ?? null,
      })
    } catch (err) {
      fotosFallidas++
      console.error("No se pudo enviar una foto:", err)
    }
  }

  return { fotosFallidas }
}
