import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"
import { gastoDesdeUsd, gastoUltimosDiasUsd, getAjustesIa, medianocheArgentina } from "@/services/ai-agent"
import { estadoTokenInstagram } from "@/services/instagram-token"
import TokenForm from "./token-form"
import styles from "./ajustes.module.css"

export default async function AjustesPage() {
  const profile = await getCurrentProfile()
  const db = createServiceClient()
  const { guardado, invalidoDesde, diasRestantes } = await estadoTokenInstagram(db)
  const [gastoHoy, gasto30d, ajustesIa] = await Promise.all([
    gastoDesdeUsd(db, medianocheArgentina()),
    gastoUltimosDiasUsd(db, 30),
    getAjustesIa(db),
  ])

  return (
    <div>
      <h1>Ajustes</h1>

      <section className={styles.card}>
        <h2>Conexión con Instagram</h2>
        {invalidoDesde ? (
          <p className={styles.malo}>
            Desconectado: Instagram rechazó el token el {new Date(invalidoDesde).toLocaleString("es-AR")}. No se pueden
            enviar mensajes hasta pegar uno nuevo.
          </p>
        ) : guardado ? (
          <p className={styles.bien}>
            Conectado. El token se renueva solo cada semana
            {diasRestantes !== null && diasRestantes > 0 ? ` (vence en unos ${diasRestantes} días si no se renueva).` : "."}
          </p>
        ) : (
          <p className={styles.neutro}>
            Usando el token cargado en Vercel. Pegá uno acá para que el CRM lo renueve automáticamente.
          </p>
        )}

        {profile?.role === "PROPIETARIA" ? (
          <TokenForm />
        ) : (
          <p className={styles.neutro}>Solo la propietaria puede cambiar esta conexión.</p>
        )}

        <details className={styles.ayuda}>
          <summary>¿Dónde consigo el token?</summary>
          <ol>
            <li>Entrá a developers.facebook.com → tu app → Casos de uso → Administrar mensajes e interacciones de Instagram.</li>
            <li>En &quot;Configuración de la API con inicio de sesión de Instagram&quot;, buscá la cuenta strawberry y tocá &quot;Generar token&quot;.</li>
            <li>Copiá el token completo y pegalo acá.</li>
          </ol>
        </details>
      </section>

      <section className={styles.card} style={{ marginTop: 16 }}>
        <h2>Gasto de IA (Anthropic)</h2>
        <p className={styles.neutro}>
          Hoy: <strong>US$ {gastoHoy.toFixed(3)}</strong> · Últimos 30 días: <strong>US$ {gasto30d.toFixed(2)}</strong> ·
          Tope diario: US$ {ajustesIa.topeDiarioUsd.toFixed(2)} (modo: {ajustesIa.modo}). Es una estimación por tokens: el
          número oficial está en console.anthropic.com → Usage.
        </p>
      </section>
    </div>
  )
}
