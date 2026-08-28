import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"
import { appendMessage } from "@/services/conversations"
import { getChannelAdapter } from "@/services/channels/registry"

export async function POST(request: Request, ctx: RouteContext<"/api/conversations/[id]/messages">) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()
  if (!body.contenido || typeof body.contenido !== "string") {
    return NextResponse.json({ error: "Falta contenido" }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: conversation, error: convError } = await db
    .schema("atencion")
    .from("conversations")
    .select("canal, canal_thread_id")
    .eq("id", id)
    .single()
  if (convError) return NextResponse.json({ error: convError.message }, { status: 404 })

  let envioError: string | null = null
  try {
    const adapter = getChannelAdapter(conversation.canal)
    await adapter.sendMessage({ canalThreadId: conversation.canal_thread_id ?? "", contenido: body.contenido })
  } catch (err) {
    // No bloquea guardar el mensaje — queda registrado igual, y se avisa
    // en la respuesta que el envío real por el canal falló o no existe todavía.
    envioError = err instanceof Error ? err.message : String(err)
  }

  const message = await appendMessage(db, {
    conversation_id: id,
    emisor: "humano",
    autor_id: profile.id,
    contenido: body.contenido,
    tipo_contenido: "texto",
  })

  // La conversación vuelve a manos de la IA salvo que ya esté cerrada —
  // responder manualmente no implica automáticamente tomar control permanente.
  await db
    .schema("atencion")
    .from("conversations")
    .update({ estado: "ia_respondiendo" })
    .eq("id", id)
    .neq("estado", "cerrada")

  return NextResponse.json({ message, envioError })
}
