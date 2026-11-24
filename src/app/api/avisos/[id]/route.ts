import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"

// Quita un aviso (la IA deja de usarlo).
export async function DELETE(_request: Request, ctx: RouteContext<"/api/avisos/[id]">) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { id } = await ctx.params
  const { error } = await createServiceClient().schema("atencion").from("avisos").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
