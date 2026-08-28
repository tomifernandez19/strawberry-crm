"use client"

import { useState } from "react"
import styles from "./meta-setup.module.css"

interface Pagina {
  pageId: string
  pageName: string
  pageAccessToken: string
  instagramAccountId: string | null
  instagramUsername: string | null
}

export default function MetaSetupPage() {
  const [appId, setAppId] = useState("")
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paginas, setPaginas] = useState<Pagina[] | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setPaginas(null)

    try {
      const res = await fetch("/api/meta/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, shortLivedToken: token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error desconocido")
      setPaginas(data.paginas)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1>Setup de Instagram / Messenger</h1>
      <p className={styles.intro}>
        Paso único. Pegá acá el App ID y el token corto que sacaste de Graph API Explorer — esta página los
        cambia por un token de página de larga duración, sin guardar nada.
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          App ID (Settings → Basic, en tu app de Meta)
          <input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="123456789012345" />
        </label>
        <label>
          Token corto (de Graph API Explorer, &ldquo;Generate Access Token&rdquo;)
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAG..." />
        </label>
        <button type="submit" disabled={loading || !appId || !token}>
          {loading ? "Procesando..." : "Convertir a token de larga duración"}
        </button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {paginas && paginas.length === 0 && (
        <p className={styles.warning}>
          No apareció ninguna página. Puede ser que el token no tenga el permiso <code>pages_show_list</code>.
        </p>
      )}

      {paginas && paginas.length > 0 && (
        <div className={styles.results}>
          {paginas.map((p) => (
            <div key={p.pageId} className={styles.card}>
              <h2>{p.pageName}</h2>
              <p>
                <strong>Page ID:</strong> <code>{p.pageId}</code>
              </p>
              <p>
                <strong>Cuenta de Instagram conectada:</strong>{" "}
                {p.instagramUsername ? `@${p.instagramUsername} (${p.instagramAccountId})` : "ninguna"}
              </p>
              <p>
                <strong>Page Access Token (larga duración):</strong>
              </p>
              <code className={styles.tokenBox}>{p.pageAccessToken}</code>
              <p className={styles.hint}>
                Copiá este valor a <code>INSTAGRAM_ACCESS_TOKEN</code> en <code>.env.local</code> y en Vercel.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
