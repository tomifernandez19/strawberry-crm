import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type Db = SupabaseClient<Database>

// Aprender de las MISMAS preguntas y respuestas: cada intercambio real
// ("pregunta de la clienta" -> "respuesta del equipo") se guarda y, ante una
// consulta nueva, se recuperan los más parecidos para que la IA imite el tono,
// el largo y el formato del equipo. Los números se enmascaran: precios, stock y
// promos salen siempre de las herramientas y de los avisos vigentes.

// Solo se guardan intercambios donde la clienta pregunta o pide algo; los
// comentarios sueltos ("amo!", "jaja") no son un modelo a imitar.
const PATRON_CONSULTA =
  /\?|precio|cuant|talle|stock|tienen|tenes|tenés|hay\b|disponib|color|foto|modelo|sandalia|bota|zapat|texana|borceg|zueco|local|sucursal|abren|abierto|horario|hora\b|env[ií]o|cambio|pago|cuota|tarjeta|efectivo|transfer|descuento|reserv|comprar|compra|web|link|medida|taco|cuero|material|talla|numero|número/i

const PATRON_PRECIO = /\$\s?\d[\d.,]*|\b\d{2,3}[.,]\d{3}\b|\b\d{5,6}\b/g
const PATRON_SALUDO_CON_NOMBRE = /\b(Hola+|Buenas|Buen d[ií]a|Buenas tardes)\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+/g

export function enmascarar(texto: string): string {
  return texto.replace(PATRON_PRECIO, "[precio]").replace(PATRON_SALUDO_CON_NOMBRE, "$1")
}

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function tokens(t: string): string[] {
  return [...new Set(normalizar(t).split(/[^a-z0-9ñ]+/).filter((x) => x.length >= 3))]
}

function parecido(a: string, b: string): number {
  const ta = new Set(tokens(a))
  const tb = new Set(tokens(b))
  if (ta.size === 0 || tb.size === 0) return 0
  let comunes = 0
  for (const x of ta) if (tb.has(x)) comunes++
  return comunes / (ta.size + tb.size - comunes)
}

interface Msg {
  id: string
  emisor: string
  contenido: string | null
  enviado_at: string
  autor_id: string | null
  ai_run_id: string | null
}

const MS_5_MIN = 5 * 60_000
const MS_3_HORAS = 3 * 3_600_000

// Saca los intercambios de una conversación. Cuentan como "equipo" las
// personas y los borradores que una persona aprobó y envió (nunca la IA sola).
export function extraerIntercambios(mensajes: Msg[]) {
  const esEquipo = (m: Msg) => m.emisor === "humano" || (m.emisor === "ia" && m.autor_id !== null && m.ai_run_id !== null)
  const texto = (m: Msg) => (m.contenido ?? "").trim()

  const salida: Array<{ pregunta: string; respuesta: string; inicioRespuestaId: string; enviadoAt: string }> = []
  let i = 0
  while (i < mensajes.length) {
    if (!esEquipo(mensajes[i]) || !texto(mensajes[i])) {
      i++
      continue
    }
    // Bloque de respuesta: mensajes seguidos del equipo (separados por menos de 5 min).
    const inicio = i
    const bloque: Msg[] = [mensajes[i]]
    let j = i + 1
    while (
      j < mensajes.length &&
      esEquipo(mensajes[j]) &&
      new Date(mensajes[j].enviado_at).getTime() - new Date(mensajes[j - 1].enviado_at).getTime() < MS_5_MIN
    ) {
      if (texto(mensajes[j])) bloque.push(mensajes[j])
      j++
    }

    // Pregunta: los mensajes de texto de la clienta justo antes (máx. 3, hasta 3 h antes).
    const preguntas: string[] = []
    let k = inicio - 1
    while (
      k >= 0 &&
      mensajes[k].emisor === "cliente" &&
      preguntas.length < 3 &&
      new Date(mensajes[inicio].enviado_at).getTime() - new Date(mensajes[k].enviado_at).getTime() < MS_3_HORAS
    ) {
      if (texto(mensajes[k])) preguntas.unshift(texto(mensajes[k]))
      k--
    }

    const pregunta = enmascarar(preguntas.join("\n")).slice(0, 400)
    const respuesta = enmascarar(bloque.slice(0, 3).map(texto).join("\n")).slice(0, 500)
    if (
      pregunta.length >= 3 &&
      respuesta.length >= 3 &&
      PATRON_CONSULTA.test(pregunta) &&
      !/https?:\/\//i.test(respuesta)
    ) {
      salida.push({ pregunta, respuesta, inicioRespuestaId: mensajes[inicio].id, enviadoAt: mensajes[inicio].enviado_at })
    }
    i = j
  }
  return salida
}

// Guarda los intercambios nuevos de estas conversaciones (no duplica).
export async function indexarEjemplos(db: Db, conversationIds: string[]): Promise<number> {
  let nuevos = 0
  for (const conversationId of conversationIds) {
    const { data } = await db
      .schema("atencion")
      .from("conversation_messages")
      .select("id, emisor, contenido, enviado_at, autor_id, ai_run_id")
      .eq("conversation_id", conversationId)
      .order("enviado_at", { ascending: true })
    const intercambios = extraerIntercambios((data ?? []) as Msg[])
    if (intercambios.length === 0) continue

    const { data: insertados } = await db
      .schema("atencion")
      .from("ejemplos")
      .upsert(
        intercambios.map((x) => ({
          conversation_id: conversationId,
          pregunta: x.pregunta,
          respuesta: x.respuesta,
          inicio_respuesta_id: x.inicioRespuestaId,
          enviado_at: x.enviadoAt,
        })),
        { onConflict: "inicio_respuesta_id", ignoreDuplicates: true }
      )
      .select("id")
    nuevos += insertados?.length ?? 0
  }
  return nuevos
}

// Los intercambios pasados más parecidos a lo que acaba de escribir la clienta.
export async function buscarEjemplos(
  db: Db,
  consulta: string,
  opciones?: { k?: number; hasta?: string }
): Promise<Array<{ pregunta: string; respuesta: string }>> {
  const palabras = tokens(consulta).slice(0, 12)
  if (palabras.length === 0) return []

  try {
    let q = db
      .schema("atencion")
      .from("ejemplos")
      .select("pregunta, respuesta, enviado_at")
      .textSearch("pregunta_tsv", palabras.join(" | "), { config: "spanish" })
      .limit(40)
    // En una simulación (replay) solo valen ejemplos anteriores a esa consulta.
    if (opciones?.hasta) q = q.lt("enviado_at", opciones.hasta)
    const { data } = await q
    return (data ?? [])
      .map((e) => ({ ...e, puntaje: parecido(consulta, e.pregunta) }))
      .filter((e) => e.puntaje >= 0.2)
      .sort((a, b) => b.puntaje - a.puntaje)
      .slice(0, opciones?.k ?? 3)
      .map(({ pregunta, respuesta }) => ({ pregunta, respuesta }))
  } catch {
    return []
  }
}
