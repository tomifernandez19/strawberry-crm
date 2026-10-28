"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "./bandeja.module.css"

// Cierra una conversación desde la lista, sin tener que abrirla.
export default function CerrarButton({ conversationId }: { conversationId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function cerrar() {
    setLoading(true)
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "cerrada" }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button className={styles.botonCerrar} disabled={loading} onClick={cerrar} title="Pasar a cerrada">
      {loading ? "…" : "Cerrar"}
    </button>
  )
}
