import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getChannelAdapter } from "@/services/channels/registry"
import { appendMessage } from "@/services/conversations"
import type { Canal } from "@/services/channels/types"

// Lo llama pg_cron (Supabase) cada un minuto vía pg_net — no Vercel Cron,
// que en el plan gratuito no deja frecuencia de 1 minuto. Todo el trabajo
// real (elegir qué está listo para salir, enviarlo, marcarlo) vive acá;
// Postgres solo da el "tic" cada minuto.
export async function POST(request: Request) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const db = createServiceClient()

  const { data: pendientes, error } = await db
    .schema("atencion")
    .from("respuestas_programadas")
    .select("id, conversation_id, contenido")
    .eq("enviado", false)
    .lte("enviar_en", new Date().toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let enviados = 0
  let fallidos = 0

  for (const pendiente of pendientes ?? []) {
    try {
      const { data: conversation } = await db
        .schema("atencion")
        .from("conversations")
        .select("canal, canal_thread_id")
        .eq("id", pendiente.conversation_id)
        .single()
      if (!conversation) throw new Error("Conversación no encontrada")

      const adapter = getChannelAdapter(conversation.canal as Canal)
      await adapter.sendMessage({ canalThreadId: conversation.canal_thread_id ?? "", contenido: pendiente.contenido })

      await appendMessage(db, {
        conversation_id: pendiente.conversation_id,
        emisor: "ia",
        contenido: pendiente.contenido,
        tipo_contenido: "texto",
      })

      await db
        .schema("atencion")
        .from("respuestas_programadas")
        .update({ enviado: true })
        .eq("id", pendiente.id)

      enviados++
    } catch (err) {
      fallidos++
      console.error(`Error enviando respuesta programada ${pendiente.id}:`, err)
    }
  }

  return NextResponse.json({ enviados, fallidos, total: pendientes?.length ?? 0 })
}
