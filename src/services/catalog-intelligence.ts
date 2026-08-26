import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { getConfirmedAttribute, setConfirmedAttribute } from "./catalog-attributes"
import { fetchAllProductos } from "./tienda-nube"

type Db = SupabaseClient<Database>

// Los seis atributos estructurados que pide el negocio (brief original).
// "colores" y "características" quedan fuera de esta lista fija porque ya
// se manejan por separado (colores vía variantes.color, del ERP).
export const ATRIBUTOS_ESPERADOS = [
  "material",
  "estilo",
  "tipo_calzado",
  "altura_cana",
  "tipo_punta",
  "tipo_taco",
] as const

export type AtributoEsperado = (typeof ATRIBUTOS_ESPERADOS)[number]

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

interface ReglaPalabraClave {
  atributo: AtributoEsperado
  valor: string
  patrones: RegExp[]
}

// Vocabulario de calzado femenino en español. Deliberadamente chico y
// conservador: mejor dejar un atributo pendiente (para que lo resuelva un
// humano o, más adelante, la IA) que adivinar mal a partir de una palabra
// ambigua.
const REGLAS: ReglaPalabraClave[] = [
  { atributo: "material", valor: "ecocuero", patrones: [/\becocuero\b/] },
  { atributo: "material", valor: "cuero", patrones: [/\bcuero\b/] },
  { atributo: "material", valor: "gamuza", patrones: [/\bgamuza\b/] },
  { atributo: "material", valor: "textil", patrones: [/\btextil\b/] },
  { atributo: "material", valor: "sintetico", patrones: [/\bsintetic[oa]\b/] },
  { atributo: "material", valor: "charol", patrones: [/\bcharol\b/] },
  { atributo: "material", valor: "lona", patrones: [/\blona\b/] },

  { atributo: "tipo_calzado", valor: "bota", patrones: [/\bbotas?\b/] },
  { atributo: "tipo_calzado", valor: "botineta", patrones: [/\bbotinetas?\b/, /\bbotitas?\b/] },
  { atributo: "tipo_calzado", valor: "zapato", patrones: [/\bzapatos?\b/] },
  { atributo: "tipo_calzado", valor: "sandalia", patrones: [/\bsandalias?\b/] },
  { atributo: "tipo_calzado", valor: "zapatilla", patrones: [/\bzapatillas?\b/] },
  { atributo: "tipo_calzado", valor: "chata", patrones: [/\bchatas?\b/] },

  { atributo: "estilo", valor: "texana", patrones: [/\btexanas?\b/] },
  { atributo: "estilo", valor: "chelsea", patrones: [/\bchelsea\b/] },
  { atributo: "estilo", valor: "stiletto", patrones: [/\bstiletto\b/] },
  { atributo: "estilo", valor: "mocasin", patrones: [/\bmocas[ií]n(es)?\b/] },
  { atributo: "estilo", valor: "borcego", patrones: [/\bborcegu?[oi]s?\b/] },
  { atributo: "estilo", valor: "alpargata", patrones: [/\balpargatas?\b/] },
  { atributo: "estilo", valor: "slingback", patrones: [/\bslingback\b/] },

  { atributo: "altura_cana", valor: "caña alta", patrones: [/\bcana alta\b/] },
  { atributo: "altura_cana", valor: "caña baja", patrones: [/\bcana baja\b/] },
  { atributo: "altura_cana", valor: "caña media", patrones: [/\bcana media\b/] },

  { atributo: "tipo_punta", valor: "punta cuadrada", patrones: [/\bpunta cuadrada\b/] },
  { atributo: "tipo_punta", valor: "punta redonda", patrones: [/\bpunta redonda\b/] },
  { atributo: "tipo_punta", valor: "punta fina", patrones: [/\bpunta fina\b/] },
  { atributo: "tipo_punta", valor: "punta ojal", patrones: [/\bpunta o?jal\b/] },

  { atributo: "tipo_taco", valor: "taco alto", patrones: [/\btaco alto\b/] },
  { atributo: "tipo_taco", valor: "taco bajo", patrones: [/\btaco bajo\b/] },
  { atributo: "tipo_taco", valor: "taco chino", patrones: [/\btaco chino\b/] },
  { atributo: "tipo_taco", valor: "taco aguja", patrones: [/\btaco aguja\b/] },
  { atributo: "tipo_taco", valor: "plataforma", patrones: [/\bplataforma\b/] },
]

export interface ResultadoDeteccion {
  modeloId: string
  yaConfirmados: AtributoEsperado[]
  confirmadosPorPalabraClave: Array<{ atributo: AtributoEsperado; valor: string }>
  pendientes: AtributoEsperado[]
}

// Sin IA: revisa qué atributos ya están confirmados, y para los que
// faltan intenta un match de texto explícito y barato (sección 9 del
// documento — "fuente = tienda_nube" se confirma sola, sin aprobación,
// porque es texto explícito, no una inferencia). Lo que no matchea queda
// "pendiente" para cuando se conecte la IA (Fase 10) — nunca se inventa.
export async function detectarAtributosFaltantes(
  db: Db,
  modeloId: string,
  descripcion: string
): Promise<ResultadoDeteccion> {
  const normalizado = normalizar(descripcion)
  const yaConfirmados: AtributoEsperado[] = []
  const confirmadosPorPalabraClave: Array<{ atributo: AtributoEsperado; valor: string }> = []
  const pendientes: AtributoEsperado[] = []

  for (const atributo of ATRIBUTOS_ESPERADOS) {
    const existente = await getConfirmedAttribute(db, modeloId, atributo)
    if (existente) {
      yaConfirmados.push(atributo)
      continue
    }

    const regla = REGLAS.find((r) => r.atributo === atributo && r.patrones.some((p) => p.test(normalizado)))
    if (regla) {
      await setConfirmedAttribute(db, {
        modelo_id: modeloId,
        atributo,
        valor: regla.valor,
        fuente: "tienda_nube",
      })
      confirmadosPorPalabraClave.push({ atributo, valor: regla.valor })
    } else {
      pendientes.push(atributo)
    }
  }

  return { modeloId, yaConfirmados, confirmadosPorPalabraClave, pendientes }
}

export interface ResumenSync {
  totalProductosTiendaNube: number
  sinVincularAlErp: number
  productosProcesados: number
  atributosConfirmadosPorPalabraClave: number
  productosConPendientes: number
}

// Job de sincronización (manual o programado). Recorre el catálogo de
// Tienda Nube, lo vincula al ERP por tiendanube_id, y corre la detección
// de huecos sobre cada uno. No inventa vínculos: un producto de Tienda
// Nube sin modelo correspondiente en el ERP se cuenta aparte, no se crea.
//
// Deliberadamente en lote: 3 consultas a Supabase en total, sin importar
// cuántos productos haya. La primera versión hacía una consulta por
// atributo por producto (~1000 para 167 modelos) y tardaba minutos —
// en Vercel eso hubiera dado timeout.
export async function sincronizarCatalogo(db: Db): Promise<ResumenSync> {
  const productos = await fetchAllProductos()

  const { data: modelos, error: modelosError } = await db
    .from("modelos")
    .select("id, tiendanube_id")
    .not("tiendanube_id", "is", null)
  if (modelosError) throw modelosError

  const modeloIdPorTiendaNubeId = new Map(modelos.map((m) => [m.tiendanube_id as string, m.id]))
  const modeloIds = modelos.map((m) => m.id)

  const { data: atributosExistentes, error: atributosError } = await db
    .schema("atencion")
    .from("product_attributes")
    .select("modelo_id, atributo")
    .eq("vigente", true)
    .in("modelo_id", modeloIds.length > 0 ? modeloIds : ["00000000-0000-0000-0000-000000000000"])
  if (atributosError) throw atributosError

  const confirmadosPorModelo = new Map<string, Set<string>>()
  for (const a of atributosExistentes) {
    if (!confirmadosPorModelo.has(a.modelo_id)) confirmadosPorModelo.set(a.modelo_id, new Set())
    confirmadosPorModelo.get(a.modelo_id)!.add(a.atributo)
  }

  let sinVincularAlErp = 0
  let productosProcesados = 0
  let productosConPendientes = 0
  const filasNuevas: Database["atencion"]["Tables"]["product_attributes"]["Insert"][] = []

  for (const producto of productos) {
    const modeloId = modeloIdPorTiendaNubeId.get(producto.tiendaNubeId)
    if (!modeloId) {
      sinVincularAlErp++
      continue
    }

    productosProcesados++
    const yaConfirmados = confirmadosPorModelo.get(modeloId) ?? new Set<string>()
    const normalizado = normalizar(producto.descripcion)
    let tienePendientes = false

    for (const atributo of ATRIBUTOS_ESPERADOS) {
      if (yaConfirmados.has(atributo)) continue

      const regla = REGLAS.find((r) => r.atributo === atributo && r.patrones.some((p) => p.test(normalizado)))
      if (regla) {
        filasNuevas.push({ modelo_id: modeloId, atributo, valor: regla.valor, fuente: "tienda_nube" })
        yaConfirmados.add(atributo)
      } else {
        tienePendientes = true
      }
    }
    if (tienePendientes) productosConPendientes++
  }

  if (filasNuevas.length > 0) {
    const { error: insertError } = await db.schema("atencion").from("product_attributes").insert(filasNuevas)
    if (insertError) throw insertError
  }

  const atributosConfirmadosPorPalabraClave = filasNuevas.length

  return {
    totalProductosTiendaNube: productos.length,
    sinVincularAlErp,
    productosProcesados,
    atributosConfirmadosPorPalabraClave,
    productosConPendientes,
  }
}

// Fase 10 — inferencia real con IA (texto con más matiz + imágenes), para
// los atributos que el paso de arriba deja en "pendientes". Depende de
// ANTHROPIC_API_KEY.
export interface AttributeProposal {
  atributo: string
  valorPropuesto: string
  origenInferencia: "texto_descripcion" | "texto_tienda_nube" | "texto_mercado_libre" | "imagen"
}

export async function analyzeModelo(): Promise<AttributeProposal[]> {
  throw new Error("Inferencia con IA todavía no implementada — Fase 10")
}
