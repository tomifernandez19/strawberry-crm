import { createServiceClient } from "@/lib/supabase/server"
import { ATRIBUTOS_ESPERADOS } from "@/services/catalog-intelligence"
import SyncButton from "./sync-button"
import styles from "./catalogo.module.css"

export default async function CatalogoPage() {
  const db = createServiceClient()

  const { data: modelos } = await db
    .from("modelos")
    .select("id, descripcion, marca, tiendanube_id")
    .eq("activo", true)
    .order("descripcion")

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

  const items = (modelos ?? []).map((m) => {
    const confirmados = porModelo.get(m.id) ?? new Map()
    return {
      ...m,
      confirmados: confirmados.size,
      pendientes: ATRIBUTOS_ESPERADOS.filter((a) => !confirmados.has(a)),
    }
  })

  const sinVincular = items.filter((i) => !i.tiendanube_id).length

  return (
    <div>
      <h1>Catálogo inteligente</h1>
      <p className={styles.intro}>
        Atributos detectados sin gastar IA todavía (texto explícito de Tienda Nube). Lo que queda pendiente
        espera a la Fase 10 (imagen + matices de texto) — nunca se inventa.
      </p>

      <SyncButton />

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
              <th>Atributos</th>
              <th>Pendientes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.descripcion}</td>
                <td>{item.marca ?? "—"}</td>
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
