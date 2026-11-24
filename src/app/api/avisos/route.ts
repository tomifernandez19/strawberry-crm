import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"

// Alta de un aviso vigente (promo, horario especial...). `hasta` es opcional (YYYY-MM-DD, inclusive).
export async function POST(request: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await request.json()
  const texto = typeof body.texto === "string" ? body.texto.trim() : ""
  if (texto.length < 5 || texto.length > 400) {
    return NextResponse.json({ error: "El aviso tiene que tener entre 5 y 400 caracteres" }, { status: 400 })
  }
  const hasta = typeof body.hasta === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.hasta) ? body.hasta : null

  const { error } = await createServiceClient().schema("atencion").from("avisos").insert({ texto, hasta })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
