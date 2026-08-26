import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"
import { listMessages, setConversationEstado } from "@/services/conversations"

export async function GET(_request: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { id } = await ctx.params
  const db = createServiceClient()

  const { data: conversation, error } = await db
    .schema("atencion")
    .from("conversations")
    .select("*")
    .eq("id", id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: customer } = await db
    .schema("atencion")
    .from("customers")
    .select("*")
    .eq("id", conversation.customer_id)
    .single()

  const messages = await listMessages(db, id)

  return NextResponse.json({ conversation, customer, messages })
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()
  const db = createServiceClient()

  const updated = await setConversationEstado(db, id, body.estado, {
    asignadoA: body.estado === "intervencion_humana" ? profile.id : body.asignadoA,
  })

  return NextResponse.json({ conversation: updated })
}
