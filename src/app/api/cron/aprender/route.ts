import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { aprenderDeConversaciones } from "@/services/aprendizaje"

export const maxDuration = 300

// Cron diario de Vercel: aprende de las conversaciones que quedaron quietas
// (más de 24 h sin actividad) desde la última vez. Manda `Authorization: Bearer ${CRON_SECRET}` solo.
async function manejar(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const db = createServiceClient()

  const { data: marca } = await db.schema("atencion").from("ajustes").select("valor").eq("clave", "aprendizaje_hasta").maybeSingle()
  const desde = typeof marca?.valor === "string" ? marca.valor : new Date(Date.now() - 2 * 86_400_000).toISOString()
  const hasta = new Date(Date.now() - 86_400_000).toISOString()

  const { data: conversaciones } = await db
    .schema("atencion")
    .from("conversations")
    .select("id")
    .gt("ultima_interaccion_at", desde)
    .lte("ultima_interaccion_at", hasta)
    .limit(80)

  const resumen = await aprenderDeConversaciones(db, (conversaciones ?? []).map((c) => c.id))
  // Solo se avanza la marca si se procesó todo el tramo (si hubo más de 80, queda para mañana).
  if ((conversaciones?.length ?? 0) < 80) {
    await db.schema("atencion").from("ajustes").upsert({ clave: "aprendizaje_hasta", valor: hasta as never, updated_at: new Date().toISOString() })
  }
  return NextResponse.json(resumen)
}

export const GET = manejar
export const POST = manejar
