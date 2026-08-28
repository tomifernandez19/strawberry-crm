import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type Db = SupabaseClient<Database>
type Customer = Database["atencion"]["Tables"]["customers"]["Row"]

type ChannelIdentity =
  | { canal: "whatsapp"; wa_id: string; telefono?: string; nombre?: string }
  | { canal: "instagram"; psid: string; nombre?: string }
  | { canal: "messenger"; psid: string; nombre?: string }

const IDENTITY_COLUMN = {
  whatsapp: "whatsapp_wa_id",
  instagram: "instagram_psid",
  messenger: "messenger_psid",
} as const

function toInsertPayload(
  identity: ChannelIdentity
): Database["atencion"]["Tables"]["customers"]["Insert"] {
  const nombre = identity.nombre ?? null
  switch (identity.canal) {
    case "whatsapp":
      return { whatsapp_wa_id: identity.wa_id, telefono: identity.telefono ?? identity.wa_id, nombre }
    case "instagram":
      return { instagram_psid: identity.psid, nombre }
    case "messenger":
      return { messenger_psid: identity.psid, nombre }
  }
}

export async function findOrCreateCustomer(db: Db, identity: ChannelIdentity): Promise<Customer> {
  const column = IDENTITY_COLUMN[identity.canal]
  const value = identity.canal === "whatsapp" ? identity.wa_id : identity.psid

  const { data: existing, error: findError } = await db
    .schema("atencion")
    .from("customers")
    .select("*")
    .eq(column, value)
    .maybeSingle()

  if (findError) throw findError
  if (existing) {
    // Completa el nombre si antes no lo teníamos (ej: el webhook no lo
    // manda, se pide aparte — puede llegar recién en un mensaje posterior).
    if (!existing.nombre && identity.nombre) {
      const { data: updated, error: updateError } = await db
        .schema("atencion")
        .from("customers")
        .update({ nombre: identity.nombre })
        .eq("id", existing.id)
        .select("*")
        .single()
      if (updateError) throw updateError
      return updated
    }
    return existing
  }

  const { data: created, error: insertError } = await db
    .schema("atencion")
    .from("customers")
    .insert(toInsertPayload(identity))
    .select("*")
    .single()

  if (insertError) throw insertError
  return created
}
