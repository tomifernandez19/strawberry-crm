import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { cerrarInactivas } from "@/services/conversations"

// Cron diario de Vercel (vercel.json): manda `Authorization: Bearer ${CRON_SECRET}` solo.
async function manejar(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const cerradas = await cerrarInactivas(createServiceClient(), 7)
  return NextResponse.json({ cerradas })
}

export const GET = manejar
export const POST = manejar
