import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { setConfirmedAttribute } from "./catalog-attributes"

type Db = SupabaseClient<Database>
type Decision = Database["atencion"]["Tables"]["human_approvals"]["Row"]["decision"]

async function logApproval(
  db: Db,
  params: {
    entidadTipo: Database["atencion"]["Tables"]["human_approvals"]["Row"]["entidad_tipo"]
    entidadId: string
    usuarioId: string
    decision: Decision
    contenidoEditado?: string
    comentario?: string
  }
) {
  const { error } = await db.schema("atencion").from("human_approvals").insert({
    entidad_tipo: params.entidadTipo,
    entidad_id: params.entidadId,
    usuario_id: params.usuarioId,
    decision: params.decision,
    contenido_editado: params.contenidoEditado ?? null,
    comentario: params.comentario ?? null,
  })
  if (error) throw error
}

// Aprobar un candidato de atributo: lo marca aprobado y lo promueve a
// product_attributes en la misma operación (sección 7.5/7.6).
export async function decideAttributeCandidate(
  db: Db,
  params: { candidateId: string; usuarioId: string; decision: "aprobado" | "rechazado"; comentario?: string }
) {
  const { data: candidate, error: fetchError } = await db
    .schema("atencion")
    .from("product_attribute_candidates")
    .select("*")
    .eq("id", params.candidateId)
    .single()
  if (fetchError) throw fetchError

  await logApproval(db, {
    entidadTipo: "attribute_candidate",
    entidadId: params.candidateId,
    usuarioId: params.usuarioId,
    decision: params.decision,
    comentario: params.comentario,
  })

  const { error: updateError } = await db
    .schema("atencion")
    .from("product_attribute_candidates")
    .update({
      estado: params.decision,
      revisado_por: params.usuarioId,
      revisado_at: new Date().toISOString(),
      notas_revision: params.comentario ?? null,
    })
    .eq("id", params.candidateId)
  if (updateError) throw updateError

  if (params.decision === "aprobado") {
    return setConfirmedAttribute(db, {
      modelo_id: candidate.modelo_id,
      atributo: candidate.atributo,
      valor: candidate.valor_propuesto,
      fuente: "ia_aprobada",
      candidata_origen_id: candidate.id,
      confirmado_por: params.usuarioId,
    })
  }

  return null
}

// Aprobar (o editar) una respuesta de IA pendiente de Nivel 2. Devuelve el
// texto final a enviar por el canal — el caller es quien efectivamente
// dispara el envío vía el adaptador correspondiente (Fase 12).
export async function decideAiRunResponse(
  db: Db,
  params: {
    aiRunId: string
    usuarioId: string
    decision: "aprobado" | "editado" | "rechazado"
    contenidoEditado?: string
    comentario?: string
  }
): Promise<{ textoFinal: string | null }> {
  const { data: run, error } = await db
    .schema("atencion")
    .from("ai_runs")
    .select("respuesta_generada")
    .eq("id", params.aiRunId)
    .single()
  if (error) throw error

  await logApproval(db, {
    entidadTipo: "ai_run",
    entidadId: params.aiRunId,
    usuarioId: params.usuarioId,
    decision: params.decision,
    contenidoEditado: params.contenidoEditado,
    comentario: params.comentario,
  })

  if (params.decision === "rechazado") return { textoFinal: null }

  return {
    textoFinal: params.decision === "editado" ? (params.contenidoEditado ?? null) : run.respuesta_generada,
  }
}

export async function decideLearnedAnswer(
  db: Db,
  params: { learnedAnswerId: string; usuarioId: string; decision: "aprobada" | "rechazada"; comentario?: string }
) {
  await logApproval(db, {
    entidadTipo: "learned_answer",
    entidadId: params.learnedAnswerId,
    usuarioId: params.usuarioId,
    decision: params.decision === "aprobada" ? "aprobado" : "rechazado",
    comentario: params.comentario,
  })

  const { data, error } = await db
    .schema("atencion")
    .from("learned_answers")
    .update({ estado: params.decision, aprobado_por: params.usuarioId })
    .eq("id", params.learnedAnswerId)
    .select("*")
    .single()
  if (error) throw error
  return data
}
