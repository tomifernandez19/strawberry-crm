import { createServiceClient } from "@/lib/supabase/server"
import ToggleButton from "./toggle-button"
import styles from "./cerebro.module.css"

const TIPO_LABEL: Record<string, string> = {
  politica: "Política",
  producto: "Producto",
  estilo: "Tono",
  otro: "Otro",
}

export default async function CerebroPage() {
  const { data } = await createServiceClient()
    .schema("atencion")
    .from("conocimiento")
    .select("*")
    .order("activo", { ascending: false })
    .order("veces_visto", { ascending: false })
    .order("created_at", { ascending: false })

  const items = data ?? []
  const activos = items.filter((i) => i.activo).length

  return (
    <div>
      <h1>Cerebro</h1>
      <p className={styles.intro}>
        Lo que la IA aprendió de las respuestas reales del equipo ({activos} activas de {items.length}). Cada día revisa
        las conversaciones nuevas. <strong>Nunca</strong> aprende precios, stock ni disponibilidad: eso lo consulta
        siempre en vivo. Si algo está mal o ya no vale, desactivalo y la IA deja de usarlo.
      </p>

      {items.length === 0 ? (
        <div className={styles.vacio}>Todavía no aprendió nada.</div>
      ) : (
        <div className={styles.lista}>
          {items.map((i) => (
            <div key={i.id} className={i.activo ? styles.item : `${styles.item} ${styles.inactivo}`}>
              <div className={styles.meta}>
                <span className={styles.tipo}>{TIPO_LABEL[i.tipo] ?? i.tipo}</span>
                {i.modelo && <span className={styles.modelo}>{i.modelo}</span>}
                <span>visto {i.veces_visto} {i.veces_visto === 1 ? "vez" : "veces"}</span>
              </div>
              <div className={styles.pregunta}>{i.pregunta}</div>
              <div className={styles.respuesta}>{i.respuesta}</div>
              <ToggleButton id={i.id} activo={i.activo} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
