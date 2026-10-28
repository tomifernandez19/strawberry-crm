"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "./cerebro.module.css"

export default function ToggleButton({ id, activo }: { id: string; activo: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function cambiar() {
    setLoading(true)
    await fetch(`/api/conocimiento/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !activo }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button className={styles.boton} disabled={loading} onClick={cambiar}>
      {activo ? "Desactivar" : "Volver a activar"}
    </button>
  )
}
