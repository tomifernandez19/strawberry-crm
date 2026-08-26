import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

// Next.js 16 renombró "Middleware" a "Proxy" (misma función). Esto solo hace
// el chequeo optimista de sesión/redirect; cada route handler protegido
// vuelve a verificar sesión + rol antes de tocar datos (Proxy no reemplaza eso).
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
