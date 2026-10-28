import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"
import { estadoTokenInstagram } from "@/services/instagram-token"
import TokenForm from "./token-form"
import styles from "./ajustes.module.css"

export default async function AjustesPage() {
  const profile = await getCurrentProfile()
  const { guardado, invalidoDesde, diasRestantes } = await estadoTokenInstagram(createServiceClient())

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
    </div>
  )
}
