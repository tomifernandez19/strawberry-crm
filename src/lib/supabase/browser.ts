import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"

// Cliente de navegador: usa la clave pública (anon/publishable), respeta RLS.
// Sirve para login/sesión de la bandeja — nunca para leer/escribir las
// tablas de atencion directamente (eso pasa siempre por el backend).
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
