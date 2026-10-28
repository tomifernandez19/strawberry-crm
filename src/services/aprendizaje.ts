import Anthropic from "@anthropic-ai/sdk"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { MODELO_IA } from "./ai-agent"

type Db = SupabaseClient<Database>
type Tipo = Database["atencion"]["Tables"]["conocimiento"]["Row"]["tipo"]

// "Cerebro" de la IA: aprende de lo que el equipo ya respondió. Regla del
// negocio: disponibilidad, stock, talles y precios se consultan SIEMPRE en
// vivo, así que acá se descartan (dos defensas: el prompt y un filtro de texto).

const PROMPT_EXTRACCION = `Sos parte del equipo de Strawberry Trejo (calzado femenino, Córdoba). Te paso conversaciones reales de Instagram entre clientas y el equipo ("Equipo:" son respuestas reales de personas de la tienda). Tu tarea es extraer conocimiento reutilizable para entrenar a una asistente virtual.

EXTRAÉ solo respuestas del equipo que sirvan para clientas futuras:
- "politica": formas de pago y tarjetas, cuotas, envíos y retiros, cambios, reservas, ubicación, horarios, cómo comprar.
- "producto": características de un modelo puntual que NO cambian (material, medida del taco o plataforma, horma, comodidad, cuidado). Poné el nombre del modelo en "modelo".
- "estilo": cómo responde el equipo ante algo recurrente (una duda, una objeción, un cumplido): la forma, el tono.
- "otro": cualquier otra información útil y estable.

NO EXTRAIGAS (descartá):
- Precios, descuentos puntuales, promos, montos de seña. Se consultan en vivo.
- Disponibilidad: si hay o no stock, talles que quedan, colores disponibles, "tenemos", "no tenemos", cuándo ingresa algo. Se consulta en vivo.
- Conversaciones que no son de clientas de calzado (agencias de marketing, colaboraciones, proveedores, contenido, reuniones).
- Datos personales (nombres, teléfonos, direcciones de clientas) y gestiones individuales de una compra.
- Respuestas sin contenido ("jaja", "sii", emojis) y respuestas que dependen de algo que no ves.

FORMA: "pregunta" es la consulta de la clienta generalizada (sin nombres ni datos personales); "respuesta" es lo que contestó el equipo, en su mismo tono y con sus mismas palabras en lo posible, sin nombres de clientas. "tema" son 2 a 4 palabras. Máximo 3 aprendizajes por conversación. Si una conversación no aporta nada, no devuelvas nada para ella.`

const ESQUEMA = {
  type: "object" as const,
  properties: {
    aprendizajes: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          conversacion: { type: "integer" as const },
          tipo: { type: "string" as const, enum: ["politica", "producto", "estilo", "otro"] },
          tema: { type: "string" as const },
          modelo: { type: "string" as const },
          pregunta: { type: "string" as const },
          respuesta: { type: "string" as const },
        },
        required: ["conversacion", "tipo", "tema", "modelo", "pregunta", "respuesta"],
        additionalProperties: false as const,
      },
    },
  },
  required: ["aprendizajes"],
  additionalProperties: false as const,
}

// Segunda defensa: aunque el modelo se equivoque, nada con pinta de precio,
// stock o disponibilidad entra al cerebro.
const PATRON_TIEMPO_REAL =
  /\$\s?\d|\b\d{2,3}[.,]?\d{3}\b|\bmil\b|\bdisponible|\bstock\b|\btenemos\b|\bquedan?\b|\bsolo (en|queda)|\bse (vendi|agot)|\bagotad|\bingres(a|o|an)\b|\btalles?\s*\d|\ben (el )?(3[5-9]|40)\b|\bsale[n]?\b.*\d|\bseña\b|\bpromo|\bdescuento/i

const PATRON_NO_CLIENTA = /colaboraci|canje|\bugc\b|agencia|marketing|meta ads|\bcontenido\b|influenc|proveedor|reuni[oó]n/i

// Temas que ya cubre la información oficial del negocio (knowledge_base): lo
// aprendido nunca los pisa, porque las conversaciones viejas quedan desactualizadas.
const PATRON_CUBIERTO_POR_OFICIAL =
  /horario|\bhora\b|\babier|cerram|atienden|tarjeta|cuota|efectivo|transferencia|naranja|visa|master|\bpago|abona|\benv[ií]o|andreani|correo argentino|cambio|devoluci|reserva|se[ñn]a|gocuotas/i

// Promos y condiciones temporales.
const PATRON_PROMO = /promo|regalo|2x1|\bdos pares|\b3x2|liquidaci|\bsale\b|oferta|black|cyber|hot ?sale/i

// Texto que el modelo agrega de su cuenta (comentarios, instrucciones, etiquetas).
const PATRON_META = /\berror\b|descartad|\bderivar\b|consultar en vivo|sin respuesta de fondo|responder con|\(.*\)\s*$/i

// Futuro, disponibilidad dicha en primera persona, o respuestas que dependen
// de una foto o de algo que no se ve ("las de la izquierda", "este modelo").
const PATRON_FUGAZ =
  /\btengo\b|\bno hay\b|recib|vamos a|van a (entrar|ingres|llegar)|\bingres|llegan? a|entrar|pr[oó]xim|quiz[aá]s?|capaz|izquierda|derecha|\barriba\b|\babajo\b|\best[aeo]s?\b|\bes[ao]s?\b|\bahi\b|\bac[aá]\b|\bse llama\b|lisboa|obispo|villa allende|nueva c[oó]rdoba|direcci[oó]n/i

// Consejos de calce en general ("un talle más") pueden no valer para otro modelo.
const PATRON_CALCE_GENERAL = /\bhorma\b|un (n[uú]mero|talle) m[aá]s|calz/i

const PATRON_PERSONAL = /@\w|\b\d{8,}\b|\bwhatsapp\b.*\d/i

const TIPOS_VALIDOS = new Set<Tipo>(["politica", "producto", "estilo", "otro"])

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function tokens(t: string): Set<string> {
  return new Set(normalizar(t).split(/\W+/).filter((x) => x.length > 3))
}

function parecido(a: string, b: string): number {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let comunes = 0
  for (const x of ta) if (tb.has(x)) comunes++
  return comunes / (ta.size + tb.size - comunes)
}

// La respuesta guardada tiene que ser (casi) palabra por palabra algo que una
// persona del equipo escribió en esa conversación: así no entra nada inventado
// ni "resumido" por el modelo.
function esTextual(respuesta: string, textoEquipo: string): boolean {
  const palabras = [...tokens(respuesta)]
  if (palabras.length === 0) return false
  const delEquipo = tokens(textoEquipo)
  return palabras.filter((p) => delEquipo.has(p)).length / palabras.length >= 0.8
}

interface Aprendizaje {
  conversacion: number
  tipo: Tipo
  tema: string
  modelo: string
  pregunta: string
  respuesta: string
}

async function transcripcion(db: Db, conversationId: string): Promise<{ texto: string; textoEquipo: string } | null> {
  const { data } = await db
    .schema("atencion")
    .from("conversation_messages")
    .select("emisor, contenido, tipo_contenido")
    .eq("conversation_id", conversationId)
    .order("enviado_at", { ascending: true })
  const lineas: string[] = []
  const deEquipo: string[] = []
  let hayEquipo = false
  for (const m of data ?? []) {
    // Las respuestas de la IA y del sistema no se aprenden: solo personas.
    if (m.emisor !== "cliente" && m.emisor !== "humano") continue
    const texto = m.contenido?.trim() || (m.tipo_contenido === "imagen" ? "[foto]" : "")
    if (!texto) continue
    if (m.emisor === "humano") {
      hayEquipo = true
      deEquipo.push(texto)
    }
    lineas.push(`${m.emisor === "cliente" ? "Clienta" : "Equipo"}: ${texto.slice(0, 500)}`)
  }
  return hayEquipo && lineas.length >= 2 ? { texto: lineas.slice(0, 60).join("\n"), textoEquipo: deEquipo.join("\n") } : null
}

async function extraerLote(
  client: Anthropic,
  lote: Array<{ id: string; texto: string; textoEquipo: string }>,
  datosNegocio: string
): Promise<{ items: Array<Aprendizaje & { conversationId: string }>; tokensIn: number; tokensOut: number }> {
  const cuerpo = lote.map((c, i) => `### CONVERSACIÓN ${i + 1}\n${c.texto}`).join("\n\n")
  const response = await client.messages.create({
    model: MODELO_IA,
    max_tokens: 6000,
    system: `${PROMPT_EXTRACCION}

DATOS OFICIALES DEL NEGOCIO (ya los conoce la asistente y MANDAN sobre cualquier conversación vieja). Descartá todo aprendizaje que repita estos datos o los contradiga (pagos, cuotas, horarios, envíos, cambios, reservas, sucursales, talles):
${datosNegocio}`,
    messages: [{ role: "user", content: cuerpo }],
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
  })
  const bloque = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")
  let items: Aprendizaje[] = []
  try {
    items = (JSON.parse(bloque?.text ?? "{}") as { aprendizajes?: Aprendizaje[] }).aprendizajes ?? []
  } catch {
    items = []
  }
  return {
    items: items
      .filter((a) => lote[a.conversacion - 1])
      .map((a) => ({ ...a, conversationId: lote[a.conversacion - 1].id })),
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
  }
}

export interface ResumenAprendizaje {
  conversacionesRevisadas: number
  conAportes: number
  guardados: number
  repetidosSumados: number
  descartadosPorFiltro: number
  tokensIn: number
  tokensOut: number
}

// Aprende de las conversaciones indicadas. Idempotente en lo importante: una
// pregunta parecida a una ya guardada suma "veces visto" en vez de duplicarse.
export async function aprenderDeConversaciones(db: Db, conversationIds: string[]): Promise<ResumenAprendizaje> {
  const client = new Anthropic({ maxRetries: 4 })
  const resumen: ResumenAprendizaje = {
    conversacionesRevisadas: 0,
    conAportes: 0,
    guardados: 0,
    repetidosSumados: 0,
    descartadosPorFiltro: 0,
    tokensIn: 0,
    tokensOut: 0,
  }

  const conTexto: Array<{ id: string; texto: string; textoEquipo: string }> = []
  for (const id of conversationIds) {
    const t = await transcripcion(db, id)
    if (t) conTexto.push({ id, ...t })
  }
  resumen.conversacionesRevisadas = conTexto.length

  const { data: kb } = await db.schema("atencion").from("knowledge_base").select("titulo, contenido").eq("estado", "activo")
  const datosNegocio = (kb ?? []).map((k) => `- ${k.titulo}: ${k.contenido}`).join("\n")
  const { data: catalogo } = await db.from("modelos").select("descripcion")
  const nombresModelos = [...new Set((catalogo ?? []).map((m) => m.descripcion.trim()).filter((n) => n.length >= 3))]

  const { data: existentes } = await db.schema("atencion").from("conocimiento").select("id, tipo, pregunta, veces_visto")
  const guardadas = [...(existentes ?? [])]
  const conAporte = new Set<string>()

  for (let i = 0; i < conTexto.length; i += 8) {
    const lote = conTexto.slice(i, i + 8)
    const { items, tokensIn, tokensOut } = await extraerLote(client, lote, datosNegocio)
    resumen.tokensIn += tokensIn
    resumen.tokensOut += tokensOut

    for (const a of items) {
      const pregunta = a.pregunta.trim()
      const respuesta = a.respuesta.trim()
      if (
        !TIPOS_VALIDOS.has(a.tipo) ||
        pregunta.length < 8 ||
        respuesta.length < 6 ||
        PATRON_TIEMPO_REAL.test(respuesta) ||
        PATRON_TIEMPO_REAL.test(pregunta) ||
        PATRON_PERSONAL.test(respuesta) ||
        PATRON_PERSONAL.test(pregunta) ||
        PATRON_NO_CLIENTA.test(`${a.tema} ${pregunta} ${respuesta}`) ||
        PATRON_CUBIERTO_POR_OFICIAL.test(`${a.tema} ${pregunta} ${respuesta}`) ||
        PATRON_PROMO.test(`${a.tema} ${pregunta} ${respuesta}`) ||
        PATRON_META.test(respuesta) ||
        PATRON_FUGAZ.test(`${a.tema} ${pregunta} ${respuesta}`) ||
        (a.tipo !== "producto" && PATRON_CALCE_GENERAL.test(`${pregunta} ${respuesta}`)) ||
        !esTextual(respuesta, lote.find((l) => l.id === a.conversationId)?.textoEquipo ?? "")
      ) {
        resumen.descartadosPorFiltro++
        continue
      }

      // Lo de un producto solo vale si es de un modelo real del catálogo: "las
      // botas son de cuero" (en general) puede ser falso para otro modelo.
      let modelo: string | null = null
      if (a.tipo === "producto") {
        const buscado = ` ${normalizar(a.modelo)} `
        modelo = nombresModelos.find((n) => buscado.includes(` ${normalizar(n)} `)) ?? null
        if (!modelo) {
          resumen.descartadosPorFiltro++
          continue
        }
      }
      conAporte.add(a.conversationId)

      const repetida = guardadas.find((g) => g.tipo === a.tipo && parecido(g.pregunta, pregunta) >= 0.6)
      if (repetida) {
        repetida.veces_visto++
        await db.schema("atencion").from("conocimiento").update({ veces_visto: repetida.veces_visto }).eq("id", repetida.id)
        resumen.repetidosSumados++
        continue
      }
      const { data: nueva } = await db
        .schema("atencion")
        .from("conocimiento")
        .insert({
          tipo: a.tipo,
          tema: a.tema.trim().slice(0, 80),
          modelo,
          pregunta,
          respuesta,
          conversation_id: a.conversationId,
        })
        .select("id, tipo, pregunta, veces_visto")
        .single()
      if (nueva) guardadas.push(nueva)
      resumen.guardados++
    }
  }
  resumen.conAportes = conAporte.size
  return resumen
}
