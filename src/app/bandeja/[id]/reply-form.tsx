"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "../bandeja.module.css"

export default function ReplyForm({ conversationId }: { conversationId: string }) {
  const router = useRouter()
  const [contenido, setContenido] = useState("")
  const [guardarComoAprendida, setGuardarComoAprendida] = useState(false)
  const [loading, setLoading] = useState(false)
  const [envioError, setEnvioError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contenido.trim()) return
    setLoading(true)
    setEnvioError(null)

    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contenido, guardarComoAprendida }),
    })
    const data = await res.json()
    if (data.envioError) setEnvioError(data.envioError)

    setContenido("")
    setGuardarComoAprendida(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <div>
      {envioError && (
        <p className={styles.envioError}>
          Se guardó en el historial, pero no se pudo enviar por el canal real: {envioError}
        </p>
      )}
      <form className={styles.replyForm} onSubmit={handleSubmit}>
        <textarea
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          placeholder="Escribir una respuesta manual..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
        />
        <button type="submit" disabled={loading || !contenido.trim()}>
          Enviar
        </button>
      </form>
      <label className={styles.guardarAprendidaLabel}>
        <input
          type="checkbox"
          checked={guardarComoAprendida}
          onChange={(e) => setGuardarComoAprendida(e.target.checked)}
        />
        Guardar esta respuesta para preguntas parecidas en el futuro
      </label>
    </div>
  )
}
