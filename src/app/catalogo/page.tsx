import Link from "next/link"
import { createServiceClient } from "@/lib/supabase/server"
import { ATRIBUTOS_ESPERADOS } from "@/services/catalog-intelligence"
import SyncButton from "./sync-button"
import styles from "./catalogo.module.css"

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ sin_stock?: string }> }) {
  const { sin_stock } = await searchParams
  const mostrarSinStock = sin_stock === "1"
  const db = createServiceClient()

  const { data: modelos } = await db
    .from("modelos")
    .select("id, descripcion, marca, tiendanube_id")
    .eq("activo", true)
    .order("descripcion")

  // Stock real: unidades DISPONIBLES por modelo. PostgREST devuelve de a 1000
  // filas, así que se pagina.
  const { data: variantes } = await db.from("variantes").select("id, modelo_id")
  const modeloDeVariante = new Map((variantes ?? []).map((v) => [v.id, v.modelo_id]))
  const stockPorModelo = new Map<string, number>()
  for (let desde = 0; ; desde += 1000) {
    const { data: unidades } = await db
      .from("unidades")
      .select("variante_id")
      .eq("estado", "DISPONIBLE")
      .range(desde, desde + 999)
    for (const u of unidades ?? []) {
      const modeloId = u.variante_id ? modeloDeVariante.get(u.variante_id) : null
      if (modeloId) stockPorModelo.set(modeloId, (stockPorModelo.get(modeloId) ?? 0) + 1)
    }
    if (!unidades || unidades.length < 1000) break
  }

  const { data: atributos } = await db
    .schema("atencion")
    .from("product_attributes")
    .select("modelo_id, atributo, valor")
    .eq("vigente", true)

  const porModelo = new Map<string, Map<string, string>>()
  for (const a of atributos ?? []) {
    if (!porModelo.has(a.modelo_id)) porModelo.set(a.modelo_id, new Map())
    porModelo.get(a.modelo_id)!.set(a.atributo, a.valor)
  }

  const todos = (modelos ?? []).map((m) => {
    const confirmados = porModelo.get(m.id) ?? new Map()
    return {
      ...m,
      stock: stockPorModelo.get(m.id) ?? 0,
      confirmados: confirmados.size,
      pendientes: ATRIBUTOS_ESPERADOS.filter((a) => !confirmados.has(a)),
    }
  })
  const sinStock = todos.filter((i) => i.stock === 0).length
  const items = mostrarSinStock ? todos : todos.filter((i) => i.stock > 0)

  const sinVincular = items.filter((i) => !i.tiendanube_id).length

  return (
    <div>
      <h1>Catálogo inteligente</h1>
      <p className={styles.intro}>
        Atributos detectados sin gastar IA todavía (texto explícito de Tienda Nube). Lo que queda pendiente
        espera a la Fase 10 (imagen + matices de texto) — nunca se inventa.
      </p>

      <SyncButton />

      <p className={styles.filtroStock}>
        {mostrarSinStock ? (
          <>
            Mostrando todos los modelos ({items.length}). <Link href="/catalogo">Ocultar los {sinStock} sin stock</Link>
          </>
        ) : (
          <>
            Mostrando {items.length} modelos con stock.{" "}
            {sinStock > 0 && <Link href="/catalogo?sin_stock=1">Mostrar también los {sinStock} sin stock</Link>}
          </>
        )}
      </p>

      {sinVincular > 0 && (
        <p className={styles.warning}>
          {sinVincular} modelo(s) del ERP no tienen <code>tiendanube_id</code> — no se pueden sincronizar hasta
          que estén vinculados.
        </p>
      )}

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Marca</th>
              <th>Stock</th>
              <th>Atributos</th>
              <th>Pendientes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.descripcion}</td>
                <td>{item.marca ?? "—"}</td>
                <td>{item.stock}</td>
                <td>
                  <span
                    className={
                      item.confirmados === ATRIBUTOS_ESPERADOS.length ? styles.badgeComplete : styles.badgePartial
                    }
                  >
                    {item.confirmados}/{ATRIBUTOS_ESPERADOS.length}
                  </span>
                </td>
                <td className={styles.pendientesList}>{item.pendientes.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
