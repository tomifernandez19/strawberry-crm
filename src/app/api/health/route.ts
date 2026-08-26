import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  const checks: Record<string, string> = {}

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    checks.supabase = "SUPABASE_SERVICE_ROLE_KEY no configurada (ver .env.local)"
    return NextResponse.json({ ok: false, checks }, { status: 503 })
  }

  try {
    const db = createServiceClient()
    const { count, error } = await db
      .schema("atencion")
      .from("customers")
      .select("*", { count: "exact", head: true })

    if (error) throw error
    checks.supabase = `conectado — atencion.customers tiene ${count ?? 0} filas`
  } catch (err) {
    checks.supabase = `error: ${err instanceof Error ? err.message : String(err)}`
    return NextResponse.json({ ok: false, checks }, { status: 503 })
  }

  checks.anthropic = process.env.ANTHROPIC_API_KEY ? "configurada" : "falta ANTHROPIC_API_KEY"

  return NextResponse.json({ ok: true, checks })
}
