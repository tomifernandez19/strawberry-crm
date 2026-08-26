// Fase 8. Alcance acotado: solo descripción, imágenes y categorías para
// alimentar el catálogo inteligente (Fase 9). Nunca precio ni stock (sección
// 10, regla dura) — eso sigue viniendo siempre de variantes/unidades.
//
// Pendiente confirmar cómo se genera hoy la sync existente de pedidos_online
// (pregunta abierta 5B del documento de arquitectura) antes de tocar nada ahí
// — este servicio no la toca.
//
// API real de Tienda Nube (confirmado contra la documentación oficial,
// no asumido): base versionada, header Authorization: Bearer, y User-Agent
// obligatorio (si falta, la API devuelve 400).

const API_VERSION = "2025-03"

interface TiendaNubeConfig {
  storeId: string
  accessToken: string
}

function getConfig(): TiendaNubeConfig {
  const storeId = process.env.TIENDANUBE_STORE_ID
  const accessToken = process.env.TIENDANUBE_ACCESS_TOKEN
  if (!storeId || !accessToken) {
    throw new Error(
      "Faltan TIENDANUBE_STORE_ID o TIENDANUBE_ACCESS_TOKEN en el entorno (ver .env.example)."
    )
  }
  return { storeId, accessToken }
}

async function tiendaNubeFetch(path: string, config: TiendaNubeConfig): Promise<unknown> {
  const url = `https://api.tiendanube.com/${API_VERSION}/${config.storeId}${path}`
  const contact = process.env.TIENDANUBE_APP_CONTACT ?? "contacto@strawberrytrejo.com"

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "User-Agent": `Strawberry Trejo CRM (${contact})`,
      "Content-Type": "application/json",
    },
  })

  if (response.status === 429) {
    throw new Error("Tienda Nube devolvió 429 (rate limit) — reintentar más tarde")
  }
  if (!response.ok) {
    throw new Error(`Tienda Nube API error ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

interface TiendaNubeApiProduct {
  id: number
  name: Record<string, string>
  description: Record<string, string>
  images: Array<{ src: string }>
  categories: Array<{ id: number; name: Record<string, string> }>
}

export interface TiendaNubeProducto {
  tiendaNubeId: string
  nombre: string
  descripcion: string
  descripcionHtml: string
  imagenes: string[]
  categorias: string[]
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function normalize(p: TiendaNubeApiProduct): TiendaNubeProducto {
  return {
    tiendaNubeId: String(p.id),
    nombre: p.name?.es ?? Object.values(p.name ?? {})[0] ?? "",
    descripcionHtml: p.description?.es ?? Object.values(p.description ?? {})[0] ?? "",
    descripcion: stripHtml(p.description?.es ?? Object.values(p.description ?? {})[0] ?? ""),
    imagenes: (p.images ?? []).map((img) => img.src),
    categorias: (p.categories ?? []).map((c) => c.name?.es ?? Object.values(c.name ?? {})[0] ?? ""),
  }
}

// La API pagina con `page`/`per_page`; se sigue pidiendo hasta que una
// página vuelve con menos productos que el tamaño pedido (o vacía).
export async function fetchAllProductos(options?: { updatedAfter?: Date }): Promise<TiendaNubeProducto[]> {
  const config = getConfig()
  const perPage = 50
  const productos: TiendaNubeProducto[] = []

  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    if (options?.updatedAfter) params.set("updated_at_min", options.updatedAfter.toISOString())

    const data = (await tiendaNubeFetch(`/products?${params}`, config)) as TiendaNubeApiProduct[]
    productos.push(...data.map(normalize))

    if (data.length < perPage) break
    // Respeta el rate limit (leaky bucket, 2 req/s de base) entre páginas.
    await new Promise((resolve) => setTimeout(resolve, 600))
  }

  return productos
}

export async function fetchProducto(tiendaNubeId: string): Promise<TiendaNubeProducto> {
  const config = getConfig()
  const data = (await tiendaNubeFetch(`/products/${tiendaNubeId}`, config)) as TiendaNubeApiProduct
  return normalize(data)
}
