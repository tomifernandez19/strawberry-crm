import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type Db = SupabaseClient<Database>

// Versión sin IA (gratis) del "agente" — Fase 9/10 lite. Clasifica por
// reglas simples, sin llamar a Claude para nada. Si no encuentra nada
// confiable, nunca inventa: manda un mensaje de espera y queda para que
// lo resuelva un humano. Reclamos nunca se auto-responden — van directo
// a intervención humana, sin ni siquiera el mensaje de espera.

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

// Lista conservadora a propósito — mejor de menos que marcar como reclamo
// algo que no lo es. Se va a poder afinar con uso real.
const PALABRAS_RECLAMO = [
  "reclamo",
  "queja",
  "problema",
  "roto",
  "rota",
  "danado",
  "danada",
  "defectuoso",
  "defectuosa",
  "mal estado",
  "no funciona",
  "no sirve",
  "pesimo",
  "terrible",
  "horrible",
  "estafa",
  "decepcion",
  "no llego",
  "no llega",
  "tarda mucho",
  "tarda demasiado",
  "cancelar pedido",
  "quiero mi dinero",
  "reembolso",
  "muy mal",
  "no me atienden",
  "no responden",
]

const PATRONES_PRECIO = [/\bprecio\b/, /\bcuanto (sale|cuesta|vale)\b/, /\bvale\b/]
const PATRONES_STOCK = [/\bstock\b/, /\btienen\b/, /\bqueda(n)?\b/, /\bhay\b/]
const REGEX_TALLE = /\btalle\s*(\d{2})\b|\b(3[3-9]|4[0-2])\b/

export type Clasificacion = "reclamo" | "precio" | "stock" | "faq" | "desconocido"

export interface ResultadoClasificacion {
  clasificacion: Clasificacion
  respuesta: string | null // null = no auto-responder (reclamo, o desconocido sin mensaje de espera)
}

const MENSAJE_ESPERA = "¡Hola! Ya te averiguo y te paso en un ratito 🙂"

async function buscarModeloMencionado(db: Db, textoNormalizado: string) {
  const { data: modelos } = await db.from("modelos").select("id, descripcion").eq("activo", true)
  return (modelos ?? []).find((m) => textoNormalizado.includes(normalizar(m.descripcion)))
}

async function buscarFaq(db: Db, textoNormalizado: string) {
  const { data: faqs } = await db.schema("atencion").from("faq").select("*").eq("activo", true)

  for (const faq of faqs ?? []) {
    const palabrasFaq = normalizar(faq.pregunta)
      .split(/\W+/)
      .filter((p) => p.length > 3)
    if (palabrasFaq.length === 0) continue

    const coincidencias = palabrasFaq.filter((p) => textoNormalizado.includes(p)).length
    if (coincidencias / palabrasFaq.length >= 0.6) return faq
  }
  return null
}

export async function clasificarYResponder(db: Db, mensaje: string): Promise<ResultadoClasificacion> {
  const normalizado = normalizar(mensaje)

  if (PALABRAS_RECLAMO.some((p) => normalizado.includes(p))) {
    return { clasificacion: "reclamo", respuesta: null }
  }

  const faq = await buscarFaq(db, normalizado)
  if (faq) {
    return { clasificacion: "faq", respuesta: faq.respuesta }
  }

  const esConsultaPrecio = PATRONES_PRECIO.some((p) => p.test(normalizado))
  const esConsultaStock = PATRONES_STOCK.some((p) => p.test(normalizado))

  if (esConsultaPrecio || esConsultaStock) {
    const modelo = await buscarModeloMencionado(db, normalizado)

    if (modelo && esConsultaPrecio) {
      const { data: variante } = await db
        .from("variantes")
        .select("precio_lista, precio_efectivo")
        .eq("modelo_id", modelo.id)
        .limit(1)
        .maybeSingle()
      if (variante) {
        // precio_lista = hasta 3 cuotas sin interés; precio_efectivo =
        // efectivo/transferencia. El precio mayorista (más de una unidad)
        // queda afuera por ahora, a pedido del negocio.
        const partes: string[] = []
        if (variante.precio_efectivo) partes.push(`$${variante.precio_efectivo} en efectivo/transferencia`)
        if (variante.precio_lista) partes.push(`$${variante.precio_lista} en hasta 3 cuotas sin interés`)

        if (partes.length > 0) {
          return {
            clasificacion: "precio",
            respuesta: `El ${modelo.descripcion} sale ${partes.join(", o ")}. ¡Cualquier otra consulta avisame!`,
          }
        }
      }
    }

    if (modelo && esConsultaStock) {
      const talleMatch = normalizado.match(REGEX_TALLE)
      const talle = talleMatch?.[1] ?? talleMatch?.[2]

      const { data: variantes } = await db.from("variantes").select("id, talle").eq("modelo_id", modelo.id)
      const varianteIds = (variantes ?? []).filter((v) => !talle || v.talle === talle).map((v) => v.id)

      if (varianteIds.length > 0) {
        const { count } = await db
          .from("unidades")
          .select("*", { count: "exact", head: true })
          .in("variante_id", varianteIds)
          .eq("estado", "DISPONIBLE")

        const disponible = (count ?? 0) > 0
        const detalleTalle = talle ? ` en talle ${talle}` : ""
        return {
          clasificacion: "stock",
          respuesta: disponible
            ? `¡Sí, tenemos ${modelo.descripcion}${detalleTalle} disponible!`
            : `Por ahora no tenemos ${modelo.descripcion}${detalleTalle} disponible. ¿Querés que te avise si reingresa?`,
        }
      }
    }
  }

  // No matcheó nada confiable — nunca se inventa, se manda a esperar.
  return { clasificacion: "desconocido", respuesta: MENSAJE_ESPERA }
}

export async function programarRespuesta(
  db: Db,
  params: { conversationId: string; conversationMessageId: string; contenido: string; clasificacion: Exclude<Clasificacion, "reclamo"> }
) {
  const enviarEn = new Date(Date.now() + 2 * 60 * 1000).toISOString()
  const { error } = await db.schema("atencion").from("respuestas_programadas").insert({
    conversation_id: params.conversationId,
    conversation_message_id: params.conversationMessageId,
    contenido: params.contenido,
    clasificacion: params.clasificacion,
    enviar_en: enviarEn,
  })
  if (error) throw error
}
