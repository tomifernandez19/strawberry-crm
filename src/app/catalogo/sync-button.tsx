"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import type { ResumenSync } from "@/services/catalog-intelligence"
import styles from "./catalogo.module.css"

export default function SyncButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [resumen, setResumen] = useState<ResumenSync | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/catalogo/sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error desconocido")
      setResumen(data.resumen)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.syncBox}>
      <button onClick={handleSync} disabled={loading}>
        {loading ? "Sincronizando..." : "Sincronizar con Tienda Nube"}
      </button>
      {error && <p className={styles.syncError}>{error}</p>}
      {resumen && (
        <p className={styles.syncSummary}>
          {resumen.totalProductosTiendaNube} productos en Tienda Nube · {resumen.productosProcesados}{" "}
          vinculados al ERP · {resumen.sinVincularAlErp} sin vincular · {resumen.atributosConfirmadosPorPalabraClave}{" "}
          atributos confirmados por palabra clave (sin gastar IA) · {resumen.productosConPendientes} productos
          todavía con atributos pendientes
        </p>
      )}
    </div>
  )
}
