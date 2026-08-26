import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"
import { listConversations } from "@/services/conversations"
import type { Database } from "@/lib/supabase/database.types"

export async function GET(request: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const estado = new URL(request.url).searchParams.get("estado") as
    | Database["atencion"]["Tables"]["conversations"]["Row"]["estado"]
    | null

  const db = createServiceClient()
  const conversations = await listConversations(db, estado ? { estado } : undefined)

  const customerIds = [...new Set(conversations.map((c) => c.customer_id))]
  const { data: customers } = await db
    .schema("atencion")
    .from("customers")
    .select("id, nombre, telefono")
    .in("id", customerIds.length > 0 ? customerIds : ["00000000-0000-0000-0000-000000000000"])

  const customerById = new Map((customers ?? []).map((c) => [c.id, c]))
  const withCustomer = conversations.map((c) => ({ ...c, customer: customerById.get(c.customer_id) ?? null }))

  return NextResponse.json({ conversations: withCustomer })
}
