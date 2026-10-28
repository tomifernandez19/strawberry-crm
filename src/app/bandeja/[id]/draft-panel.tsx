"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "../bandeja.module.css"

interface Props {
  borradorId: string
  contenido: string
  fotos: string[]
}

export default function DraftPanel({ borradorId, contenido, fotos }: Props) {
  const router = useRouter()
  const [texto, setTexto] = useState(contenido)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resolver(accion: "enviar" | "descartar") {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/borradores/${borradorId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion, contenido: texto }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "No se pudo completar la acción")
      setLoading(false)
      return
    }
    if (data.fotosFallidas) setError(`El texto salió, pero ${data.fotosFallidas} foto(s) no se pudieron enviar.`)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className={styles.draftPanel}>
      <div className={styles.draftTitle}>Borrador de la IA — revisalo antes de enviar</div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} disabled={loading} />
      {fotos.length > 0 && (
        <div className={styles.draftFotos}>
          {fotos.map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={f} src={f} alt="Foto adjunta" />
          ))}
          <span>Se envían junto con el mensaje</span>
        </div>
      )}
      {error && <p className={styles.envioError}>{error}</p>}
      <div className={styles.draftActions}>
        <button onClick={() => resolver("enviar")} disabled={loading || !texto.trim()}>
          Enviar
        </button>
        <button onClick={() => resolver("descartar")} disabled={loading} className={styles.draftDescartar}>
          Descartar (lo respondo yo)
        </button>
      </div>
    </div>
  )
}
