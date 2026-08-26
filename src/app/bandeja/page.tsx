import Link from "next/link"
import { createServiceClient } from "@/lib/supabase/server"
import { listConversations } from "@/services/conversations"
import styles from "./bandeja.module.css"

const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  mercado_libre: "Mercado Libre",
}

const ESTADO_LABEL: Record<string, string> = {
  nueva: "Nueva",
  ia_respondiendo: "IA respondiendo",
  requiere_aprobacion: "Requiere aprobación",
  intervencion_humana: "Intervención humana",
  cerrada: "Cerrada",
}

export default async function BandejaPage() {
  const db = createServiceClient()
  const conversations = await listConversations(db)

  const customerIds = [...new Set(conversations.map((c) => c.customer_id))]
  const { data: customers } = await db
    .schema("atencion")
    .from("customers")
    .select("id, nombre, telefono")
    .in("id", customerIds.length > 0 ? customerIds : ["00000000-0000-0000-0000-000000000000"])
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]))

  return (
    <div>
      <h1>Conversaciones</h1>

      {conversations.length === 0 ? (
        <div className={styles.emptyState}>
          Todavía no hay conversaciones. Van a empezar a aparecer acá apenas se conecte el primer canal
          (Fase 12), o podés cargar una de prueba directo en Supabase mientras tanto.
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Canal</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Última interacción</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((c) => {
              const customer = customerById.get(c.customer_id)
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/bandeja/${c.id}`}>{CANAL_LABEL[c.canal] ?? c.canal}</Link>
                  </td>
                  <td>{customer?.nombre ?? customer?.telefono ?? "—"}</td>
                  <td>
                    <span className={`${styles.pill} ${styles[c.estado]}`}>{ESTADO_LABEL[c.estado]}</span>
                  </td>
                  <td>{new Date(c.ultima_interaccion_at).toLocaleString("es-AR")}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
