import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"
import { ATRIBUTOS_ESPERADOS } from "@/services/catalog-intelligence"

export async function GET() {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const db = createServiceClient()

  const { data: modelos, error: modelosError } = await db
    .from("modelos")
    .select("id, descripcion, marca, tiendanube_id, activo")
    .eq("activo", true)
    .order("descripcion")
  if (modelosError) return NextResponse.json({ error: modelosError.message }, { status: 500 })

  const { data: atributos, error: atributosError } = await db
    .schema("atencion")
    .from("product_attributes")
    .select("modelo_id, atributo, valor")
    .eq("vigente", true)
  if (atributosError) return NextResponse.json({ error: atributosError.message }, { status: 500 })

  const porModelo = new Map<string, Map<string, string>>()
  for (const a of atributos) {
    if (!porModelo.has(a.modelo_id)) porModelo.set(a.modelo_id, new Map())
    porModelo.get(a.modelo_id)!.set(a.atributo, a.valor)
  }

  const items = modelos.map((m) => {
    const confirmados = porModelo.get(m.id) ?? new Map()
    const pendientes = ATRIBUTOS_ESPERADOS.filter((a) => !confirmados.has(a))
    return {
      id: m.id,
      descripcion: m.descripcion,
      marca: m.marca,
      vinculadoATiendaNube: Boolean(m.tiendanube_id),
      atributos: Object.fromEntries(confirmados),
      confirmados: ATRIBUTOS_ESPERADOS.length - pendientes.length,
      total: ATRIBUTOS_ESPERADOS.length,
      pendientes,
    }
  })

  return NextResponse.json({ items })
}
