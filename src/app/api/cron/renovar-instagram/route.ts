import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { renovarTokenSiCorresponde } from "@/services/instagram-token"

// Lo llama el cron diario de Vercel (vercel.json), que manda
// `Authorization: Bearer ${CRON_SECRET}` solo.
async function manejar(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const resultado = await renovarTokenSiCorresponde(createServiceClient())
  return NextResponse.json({ resultado })
}

export const GET = manejar
export const POST = manejar
