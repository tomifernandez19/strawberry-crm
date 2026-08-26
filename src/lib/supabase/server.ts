import "server-only"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

// Cliente de backend: usa la service role key, salta RLS.
// Nunca importar este archivo desde código que corra en el navegador
// ("server-only" hace que el build falle si eso pasa por error).
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno. " +
        "Revisá .env.local (la service role key se consigue en Supabase Dashboard > Project Settings > API)."
    )
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

// Tablas del schema atencion, tipadas.
export function atencion(db: ReturnType<typeof createServiceClient>) {
  return db.schema("atencion")
}
