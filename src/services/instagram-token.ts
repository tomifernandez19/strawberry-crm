import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { createServiceClient } from "@/lib/supabase/server"
import { avisarEquipo } from "./notifications"

type Db = SupabaseClient<Database>

const API = "https://graph.instagram.com"
const CLAVE_TOKEN = "instagram_token"
const CLAVE_INVALIDO = "instagram_token_invalido"
const CLAVE_ULTIMO_AVISO = "instagram_token_ultimo_aviso"
const DIAS_TOKEN = 60
const DIAS_ENTRE_RENOVACIONES = 7

// Los tokens de Instagram duran 60 días y se pueden renovar (una vez que
// tienen más de 24 h y mientras no hayan vencido). El token vive en
// atencion.ajustes para poder cambiarlo/renovarlo sin tocar Vercel; la
// variable INSTAGRAM_ACCESS_TOKEN queda solo como respaldo inicial.
interface TokenGuardado {
  token: string
  renovado_at: string
  expira_at: string
}

let cache: { token: string; hasta: number } | null = null

export function olvidarTokenEnMemoria() {
  cache = null
}

async function leerAjuste<T>(db: Db, clave: string): Promise<T | null> {
  const { data } = await db.schema("atencion").from("ajustes").select("valor").eq("clave", clave).maybeSingle()
  return (data?.valor as T | undefined) ?? null
}

async function escribirAjuste(db: Db, clave: string, valor: unknown) {
  await db.schema("atencion").from("ajustes").upsert({ clave, valor: valor as never, updated_at: new Date().toISOString() })
}

async function borrarAjuste(db: Db, clave: string) {
  await db.schema("atencion").from("ajustes").delete().eq("clave", clave)
}

export async function obtenerTokenInstagram(db?: Db): Promise<string | null> {
  if (cache && cache.hasta > Date.now()) return cache.token
  const guardado = await leerAjuste<TokenGuardado>(db ?? createServiceClient(), CLAVE_TOKEN)
  const token = guardado?.token ?? process.env.INSTAGRAM_ACCESS_TOKEN ?? null
  cache = token ? { token, hasta: Date.now() + 60_000 } : null
  return token
}

export async function estadoTokenInstagram(db: Db): Promise<{
  guardado: TokenGuardado | null
  invalidoDesde: string | null
  diasRestantes: number | null
}> {
  const guardado = await leerAjuste<TokenGuardado>(db, CLAVE_TOKEN)
  return {
    guardado,
    invalidoDesde: await leerAjuste<string>(db, CLAVE_INVALIDO),
    diasRestantes: guardado ? Math.ceil((new Date(guardado.expira_at).getTime() - Date.now()) / 86_400_000) : null,
  }
}

// Pregunta a Instagram a quién pertenece el token. Si falla, el token no sirve.
export async function verificarToken(token: string): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API}/v25.0/me?fields=username&access_token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = (await res.json()) as { username?: string; error?: { message?: string } }
    if (!res.ok || !data.username) return { ok: false, error: data.error?.message ?? `Instagram respondió ${res.status}` }
    return { ok: true, username: data.username }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function guardarTokenInstagram(db: Db, token: string, segundosDeVida = DIAS_TOKEN * 86_400) {
  const ahora = Date.now()
  await escribirAjuste(db, CLAVE_TOKEN, {
    token,
    renovado_at: new Date(ahora).toISOString(),
    // Margen de un día por si el cálculo de Meta difiere.
    expira_at: new Date(ahora + (segundosDeVida - 86_400) * 1000).toISOString(),
  } satisfies TokenGuardado)
  await borrarAjuste(db, CLAVE_INVALIDO)
  olvidarTokenEnMemoria()
}

// Un envío falló porque Instagram rechazó el token: se deja marcado (el CRM
// muestra un cartel) y se avisa al celular, como mucho una vez cada 6 horas.
export async function marcarTokenInvalido(db?: Db) {
  const cliente = db ?? createServiceClient()
  await escribirAjuste(cliente, CLAVE_INVALIDO, new Date().toISOString())
  olvidarTokenEnMemoria()

  const ultimo = await leerAjuste<string>(cliente, CLAVE_ULTIMO_AVISO)
  if (ultimo && Date.now() - new Date(ultimo).getTime() < 6 * 3_600_000) return
  await escribirAjuste(cliente, CLAVE_ULTIMO_AVISO, new Date().toISOString())
  await avisarEquipo(cliente, {
    titulo: "Instagram desconectado",
    mensaje: "El token de Instagram venció: no se pueden enviar mensajes. Renovalo en Ajustes del CRM.",
    ruta: "/ajustes",
  })
}

// Renueva el token si ya pasaron DIAS_ENTRE_RENOVACIONES desde la última vez.
// Lo corre un cron diario de Vercel. Si el token ya venció, no hay forma de
// renovarlo: hay que generar uno nuevo desde el panel de Meta.
export async function renovarTokenSiCorresponde(
  db: Db
): Promise<"renovado" | "no_corresponde" | "sin_token" | "fallo"> {
  const guardado = await leerAjuste<TokenGuardado>(db, CLAVE_TOKEN)
  const token = guardado?.token ?? process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) return "sin_token"

  if (guardado && Date.now() - new Date(guardado.renovado_at).getTime() < DIAS_ENTRE_RENOVACIONES * 86_400_000) {
    return "no_corresponde"
  }

  try {
    const res = await fetch(
      `${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(10_000) }
    )
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } }
    if (!res.ok || !data.access_token) {
      console.error("No se pudo renovar el token de Instagram:", data.error?.message ?? res.status)
      await marcarTokenInvalido(db)
      return "fallo"
    }
    await guardarTokenInstagram(db, data.access_token, data.expires_in ?? DIAS_TOKEN * 86_400)
    return "renovado"
  } catch (err) {
    console.error("Error renovando el token de Instagram:", err)
    return "fallo"
  }
}
