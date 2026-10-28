import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"

// Activa o desactiva una entrada del cerebro (lo desactivado la IA deja de usarlo).
export async function PATCH(request: Request, ctx: RouteContext<"/api/conocimiento/[id]">) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()
  if (typeof body.activo !== "boolean") return NextResponse.json({ error: "Falta activo" }, { status: 400 })

  const { error } = await createServiceClient().schema("atencion").from("conocimiento").update({ activo: body.activo }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
