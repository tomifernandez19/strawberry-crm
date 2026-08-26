import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type Db = SupabaseClient<Database>
type Attribute = Database["atencion"]["Tables"]["product_attributes"]["Row"]
type Candidate = Database["atencion"]["Tables"]["product_attribute_candidates"]["Row"]

// Nivel 1: hecho confirmado. Nunca se lee un candidato desde acá.
export async function getConfirmedAttribute(
  db: Db,
  modeloId: string,
  atributo: string
): Promise<Attribute | null> {
  const { data, error } = await db
    .schema("atencion")
    .from("product_attributes")
    .select("*")
    .eq("modelo_id", modeloId)
    .eq("atributo", atributo)
    .eq("vigente", true)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getLatestCandidate(
  db: Db,
  modeloId: string,
  atributo: string
): Promise<Candidate | null> {
  const { data, error } = await db
    .schema("atencion")
    .from("product_attribute_candidates")
    .select("*")
    .eq("modelo_id", modeloId)
    .eq("atributo", atributo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createCandidate(
  db: Db,
  candidate: Database["atencion"]["Tables"]["product_attribute_candidates"]["Insert"]
): Promise<Candidate> {
  const { data, error } = await db
    .schema("atencion")
    .from("product_attribute_candidates")
    .insert(candidate)
    .select("*")
    .single()

  if (error) throw error
  return data
}

// Corrección de un atributo: nunca UPDATE in-place. Se apaga la vigencia
// anterior (si existe) y se inserta la fila nueva — así queda el historial
// completo de quién dijo qué y cuándo (sección 7.4).
export async function setConfirmedAttribute(
  db: Db,
  params: Pick<Attribute, "modelo_id" | "atributo" | "valor" | "fuente"> &
    Partial<Pick<Attribute, "candidata_origen_id" | "confirmado_por">>
): Promise<Attribute> {
  const { error: supersedeError } = await db
    .schema("atencion")
    .from("product_attributes")
    .update({ vigente: false })
    .eq("modelo_id", params.modelo_id)
    .eq("atributo", params.atributo)
    .eq("vigente", true)

  if (supersedeError) throw supersedeError

  const { data, error } = await db
    .schema("atencion")
    .from("product_attributes")
    .insert(params)
    .select("*")
    .single()

  if (error) throw error
  return data
}
