import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"
import { guardarTokenInstagram, verificarToken } from "@/services/instagram-token"

// Guarda un token nuevo de Instagram (el que se genera en el panel de Meta).
// Se verifica contra Instagram antes de guardarlo: nunca se guarda uno que no sirva.
export async function POST(request: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  if (profile.role !== "PROPIETARIA") {
    return NextResponse.json({ error: "Solo la propietaria puede cambiar la conexión de Instagram" }, { status: 403 })
  }

  const body = await request.json()
  const token = typeof body.token === "string" ? body.token.trim() : ""
  if (token.length < 20) return NextResponse.json({ error: "El token parece incompleto" }, { status: 400 })

  const verificacion = await verificarToken(token)
  if (!verificacion.ok) {
    return NextResponse.json({ error: `Instagram no aceptó ese token: ${verificacion.error}` }, { status: 400 })
  }

  await guardarTokenInstagram(createServiceClient(), token)
  return NextResponse.json({ ok: true, username: verificacion.username })
}
