"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "../bandeja.module.css"

export default function ConversationActions({
  conversationId,
  estado,
}: {
  conversationId: string
  estado: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function setEstado(nuevoEstado: string) {
    setLoading(true)
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevoEstado }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className={styles.actions}>
      {estado !== "intervencion_humana" && (
        <button disabled={loading} onClick={() => setEstado("intervencion_humana")}>
          Tomar control manual
        </button>
      )}
      {estado === "intervencion_humana" && (
        <button disabled={loading} onClick={() => setEstado("ia_respondiendo")}>
          Devolver a la IA
        </button>
      )}
      {estado !== "cerrada" && (
        <button disabled={loading} onClick={() => setEstado("cerrada")}>
          Cerrar conversación
        </button>
      )}
      {estado === "cerrada" && (
        <button disabled={loading} onClick={() => setEstado("nueva")}>
          Reabrir
        </button>
      )}
    </div>
  )
}
