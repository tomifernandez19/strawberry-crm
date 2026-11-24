"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "./ajustes.module.css"

interface Aviso {
  id: string
  texto: string
  hasta: string | null
}

export default function AvisosForm({ avisos }: { avisos: Aviso[] }) {
  const router = useRouter()
  const [texto, setTexto] = useState("")
  const [hasta, setHasta] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch("/api/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, hasta: hasta || null }),
    })
    const data = await res.json()
    if (res.ok) {
      setTexto("")
      setHasta("")
      router.refresh()
    } else {
      setError(data.error ?? "No se pudo guardar el aviso")
    }
    setLoading(false)
  }

  async function quitar(id: string) {
    await fetch(`/api/avisos/${id}`, { method: "DELETE" })
    router.refresh()
  }

  return (
    <div>
      {avisos.length === 0 ? (
        <p className={styles.neutro}>No hay avisos cargados. La IA usa solo los datos fijos del negocio.</p>
      ) : (
        <ul className={styles.listaAvisos}>
          {avisos.map((a) => (
            <li key={a.id}>
              <span>
                {a.texto}
                {a.hasta ? <em> — hasta el {a.hasta}</em> : null}
              </span>
              <button onClick={() => quitar(a.id)}>Quitar</button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={agregar} className={styles.form}>
        <label htmlFor="aviso">Nuevo aviso</label>
        <textarea
          id="aviso"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={400}
          placeholder='Ej: "Cyberweek: 25% de descuento pagando por transferencia y 30% en efectivo; hasta 6 cuotas sin interés con tarjeta."'
        />
        <label htmlFor="hasta">Vigente hasta (opcional)</label>
        <input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <button type="submit" disabled={loading || texto.trim().length < 5}>
          {loading ? "Guardando..." : "Agregar aviso"}
        </button>
        {error && <p className={styles.malo}>{error}</p>}
      </form>
    </div>
  )
}
