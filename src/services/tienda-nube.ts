// Fase 8. Depende de TIENDANUBE_CLIENT_ID/SECRET/STORE_ID (.env.example) —
// pendiente confirmar cómo se genera hoy la sync existente de pedidos_online
// (pregunta abierta 5B del documento de arquitectura) antes de tocar nada ahí.
//
// Alcance acotado: solo descripción, imágenes y categorías para alimentar
// el catálogo inteligente. Nunca precio ni stock (sección 10, regla dura).

export interface TiendaNubeProducto {
  tiendaNubeId: string
  nombre: string
  descripcion: string
  imagenes: string[]
  categorias: string[]
}

export async function fetchProducto(): Promise<TiendaNubeProducto> {
  throw new Error("TiendaNubeService todavía no implementado — Fase 8")
}
