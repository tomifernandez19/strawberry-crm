import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"
import { setConversationEstado } from "@/services/conversations"
import { enviarRespuesta } from "@/services/outbound"

// Aprobar (con o sin edición) o descartar un borrador que dejó la IA.
export async function POST(request: Request, ctx: RouteContext<"/api/borradores/[id]">) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()
  if (body.accion !== "enviar" && body.accion !== "descartar") {
    return NextResponse.json({ error: "accion debe ser 'enviar' o 'descartar'" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: borrador } = await db.schema("atencion").from("borradores_ia").select("*").eq("id", id).maybeSingle()
  if (!borrador) return NextResponse.json({ error: "Borrador no encontrado" }, { status: 404 })
  if (borrador.estado !== "pendiente") {
    return NextResponse.json({ error: "Este borrador ya fue resuelto" }, { status: 409 })
  }

  const resolver = (estado: "enviado" | "descartado") =>
    db
      .schema("atencion")
      .from("borradores_ia")
      .update({ estado, resuelto_at: new Date().toISOString(), resuelto_por: profile.id })
      .eq("id", id)
      .eq("estado", "pendiente")

  const registrarDecision = async (decision: "aprobado" | "editado" | "rechazado", contenidoEditado?: string) => {
    if (!borrador.ai_run_id) return
    await db.schema("atencion").from("human_approvals").insert({
      entidad_tipo: "ai_run",
      entidad_id: borrador.ai_run_id,
      usuario_id: profile.id,
      decision,
      contenido_editado: contenidoEditado ?? null,
    })
  }

  if (body.accion === "descartar") {
    await resolver("descartado")
    await registrarDecision("rechazado")
    // Si la IA no supo, lo atiende una persona.
    await setConversationEstado(db, borrador.conversation_id, "intervencion_humana")
    return NextResponse.json({ ok: true })
  }

  const contenido: string = typeof body.contenido === "string" && body.contenido.trim() ? body.contenido.trim() : borrador.contenido
  const editado = contenido !== borrador.contenido

  try {
    const { fotosFallidas } = await enviarRespuesta(db, {
      conversationId: borrador.conversation_id,
      contenido,
      fotos: borrador.fotos,
      emisor: "ia",
      autorId: profile.id,
      aiRunId: borrador.ai_run_id,
    })
    await resolver("enviado")
    await registrarDecision(editado ? "editado" : "aprobado", editado ? contenido : undefined)
    await setConversationEstado(db, borrador.conversation_id, borrador.requiere_seguimiento ? "intervencion_humana" : "ia_respondiendo")
    return NextResponse.json({ ok: true, fotosFallidas })
  } catch (err) {
    // El borrador queda pendiente para reintentar.
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
