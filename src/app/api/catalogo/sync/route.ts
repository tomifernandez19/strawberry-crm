import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"
import { sincronizarCatalogo } from "@/services/catalog-intelligence"

export async function POST() {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const db = createServiceClient()
  const resumen = await sincronizarCatalogo(db)
  return NextResponse.json({ resumen })
}
