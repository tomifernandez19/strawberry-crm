import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"
import { gastoDesdeUsd, gastoUltimosDiasUsd, getAjustesIa, hoyArgentina, medianocheArgentina } from "@/services/ai-agent"
import { estadoTokenInstagram } from "@/services/instagram-token"
import AvisosForm from "./avisos-form"
import TokenForm from "./token-form"
import styles from "./ajustes.module.css"

export default async function AjustesPage() {
  const profile = await getCurrentProfile()
  const db = createServiceClient()
  const { guardado, invalidoDesde, diasRestantes } = await estadoTokenInstagram(db)
  const { data: avisosTodos } = await db.schema("atencion").from("avisos").select("id, texto, hasta").eq("activo", true).order("created_at", { ascending: false })
  const avisos = (avisosTodos ?? []).filter((a) => !a.hasta || a.hasta >= hoyArgentina())
  const [gastoHoy, gasto30d, ajustesIa] = await Promise.all([
    gastoDesdeUsd(db, medianocheArgentina()),
    gastoUltimosDiasUsd(db, 30),
    getAjustesIa(db),
  ])

  return (
    <div>
      <h1>Ajustes</h1>

      <section className={styles.card} style={{ marginBottom: 16 }}>
        <h2>Avisos para clientas (promos y horarios especiales)</h2>
        <p className={styles.neutro}>
          Lo que cargues acá lo usa la IA en sus respuestas, por encima de los datos fijos: promos del momento
          (&quot;Cyberweek&quot;), descuentos distintos al habitual, horarios especiales o feriados. Poné la fecha en que
          vence y el aviso se apaga solo. Si algo cambió y no está acá, la IA responde con los datos de siempre.
        </p>
        <AvisosForm avisos={avisos} />
      </section>

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
