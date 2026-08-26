import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "./database.types"

// Cliente con la sesión del usuario logueado (clave anon + cookies), respeta
// RLS. Sirve para saber quién es y su rol — nunca para leer/escribir atencion.
export async function createSessionClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Se llama también desde Server Components donde no se pueden
            // setear cookies; el Proxy ya se encarga de refrescar la sesión.
          }
        },
      },
    }
  )
}

export async function getCurrentProfile() {
  const supabase = await createSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  return profile
}
