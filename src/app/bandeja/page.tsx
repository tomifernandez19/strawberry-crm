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
  intervencion_humana: "Derivada al equipo",
  cerrada: "Cerrada",
}

const VISTAS = [
  { id: "atender", label: "Para atender" },
  { id: "recientes", label: "Recientes (7 días)" },
  { id: "todas", label: "Todas" },
] as const

export default async function BandejaPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista: vistaParam } = await searchParams
  const vista = VISTAS.find((v) => v.id === vistaParam)?.id ?? "atender"

  const db = createServiceClient()
  const REQUIERE_ATENCION = new Set(["intervencion_humana", "requiere_aprobacion"])

  const atender = (await listConversations(db)).filter((c) => REQUIERE_ATENCION.has(c.estado))
  const conversations =
    vista === "atender"
      ? atender
      : vista === "recientes"
        ? await listConversations(db, { ultimosDias: 7, excluirCerradas: true })
        : await listConversations(db, { limite: 300 })
  const pendientes = atender.length

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
      <div className={styles.vistas}>
        {VISTAS.map((v) => (
          <Link
            key={v.id}
            href={`/bandeja?vista=${v.id}`}
            prefetch={false}
            className={v.id === vista ? `${styles.vista} ${styles.vistaActiva}` : styles.vista}
          >
            {v.label}
            {v.id === "atender" && pendientes > 0 ? ` (${pendientes})` : ""}
          </Link>
        ))}
      </div>

      {conversations.length === 0 ? (
        <div className={styles.emptyState}>
          {vista === "atender" ? "No hay nada esperando al equipo. 🎉" : "No hay conversaciones para mostrar."}
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Canal</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Motivo</th>
              <th>Última interacción</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((c) => {
              const customer = customerById.get(c.customer_id)
              return (
                <tr key={c.id} className={REQUIERE_ATENCION.has(c.estado) ? styles.filaAtencion : undefined}>
                  <td>
                    <Link href={`/bandeja/${c.id}`} prefetch={false}>{CANAL_LABEL[c.canal] ?? c.canal}</Link>
                  </td>
                  <td>{customer?.nombre ?? customer?.telefono ?? "—"}</td>
                  <td>
                    <span className={`${styles.pill} ${styles[c.estado]}`}>{ESTADO_LABEL[c.estado]}</span>
                  </td>
                  <td className={styles.motivo}>{REQUIERE_ATENCION.has(c.estado) ? (c.motivo_atencion ?? "") : ""}</td>
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
