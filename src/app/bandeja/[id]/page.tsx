import { notFound } from "next/navigation"
import Link from "next/link"
import { createServiceClient } from "@/lib/supabase/server"
import { listMessages } from "@/services/conversations"
import ConversationActions from "./actions"
import DraftPanel from "./draft-panel"
import ReplyForm from "./reply-form"
import styles from "../bandeja.module.css"

const EMISOR_LABEL: Record<string, string> = {
  cliente: "Cliente",
  ia: "IA",
  humano: "Vos",
  sistema: "Sistema",
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = createServiceClient()

  const { data: conversation } = await db.schema("atencion").from("conversations").select("*").eq("id", id).single()
  if (!conversation) notFound()

  const { data: customer } = await db
    .schema("atencion")
    .from("customers")
    .select("*")
    .eq("id", conversation.customer_id)
    .single()

  const messages = await listMessages(db, id)

  const { data: borrador } = await db
    .schema("atencion")
    .from("borradores_ia")
    .select("id, contenido, fotos")
    .eq("conversation_id", id)
    .eq("estado", "pendiente")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div>
      <Link href="/bandeja" className={styles.backLink}>
        ← Todas las conversaciones
      </Link>

      <div className={styles.detailHeader}>
        <div>
          <h1 style={{ margin: 0 }}>{customer?.nombre ?? customer?.telefono ?? "Cliente"}</h1>
          <p style={{ margin: "4px 0 0", color: "#8b7a7e" }}>
            {conversation.canal} · <span className={`${styles.pill} ${styles[conversation.estado]}`}>{conversation.estado}</span>
          </p>
        </div>
        <ConversationActions conversationId={conversation.id} estado={conversation.estado} />
      </div>

      {conversation.motivo_atencion && (conversation.estado === "intervencion_humana" || conversation.estado === "requiere_aprobacion") && (
        <p className={styles.bannerAtencion}>{conversation.motivo_atencion}</p>
      )}

      <div className={styles.thread}>
        {messages.length === 0 && <p style={{ color: "#8b7a7e" }}>Sin mensajes todavía.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`${styles.bubble} ${styles[m.emisor]}`}>
            {m.media_url && m.tipo_contenido === "imagen" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.media_url} alt="Imagen" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 4 }} />
            )}
            {m.contenido && <div>{m.contenido}</div>}
            <div className={styles.bubbleMeta}>
              {EMISOR_LABEL[m.emisor]} · {new Date(m.enviado_at).toLocaleString("es-AR")}
            </div>
          </div>
        ))}
      </div>

      {borrador && (
        <DraftPanel key={borrador.id} borradorId={borrador.id} contenido={borrador.contenido} fotos={borrador.fotos} />
      )}

      <ReplyForm conversationId={conversation.id} />
    </div>
  )
}
