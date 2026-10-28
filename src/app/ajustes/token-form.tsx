"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "./ajustes.module.css"

export default function TokenForm() {
  const router = useRouter()
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMensaje(null)
    const res = await fetch("/api/ajustes/instagram-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (res.ok) {
      setMensaje({ ok: true, texto: `Listo: conectado a @${data.username}.` })
      setToken("")
      router.refresh()
    } else {
      setMensaje({ ok: false, texto: data.error ?? "No se pudo guardar el token" })
    }
    setLoading(false)
  }

  return (
    <form onSubmit={guardar} className={styles.form}>
      <label htmlFor="token">Token nuevo de Instagram</label>
      <textarea
        id="token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        rows={3}
        placeholder="Pegá el token acá"
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" disabled={loading || token.trim().length < 20}>
        {loading ? "Verificando..." : "Guardar y verificar"}
      </button>
      {mensaje && <p className={mensaje.ok ? styles.bien : styles.malo}>{mensaje.texto}</p>}
    </form>
  )
}
