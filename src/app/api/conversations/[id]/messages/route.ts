import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"
import { appendMessage } from "@/services/conversations"

export async function POST(request: Request, ctx: RouteContext<"/api/conversations/[id]/messages">) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()
  if (!body.contenido || typeof body.contenido !== "string") {
    return NextResponse.json({ error: "Falta contenido" }, { status: 400 })
  }

  const db = createServiceClient()
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

  return NextResponse.json({ message })
}
