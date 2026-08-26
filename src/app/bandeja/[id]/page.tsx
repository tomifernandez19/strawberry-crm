import { notFound } from "next/navigation"
import Link from "next/link"
import { createServiceClient } from "@/lib/supabase/server"
import { listMessages } from "@/services/conversations"
import ConversationActions from "./actions"
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

      <div className={styles.thread}>
        {messages.length === 0 && <p style={{ color: "#8b7a7e" }}>Sin mensajes todavía.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`${styles.bubble} ${styles[m.emisor]}`}>
            <div>{m.contenido}</div>
            <div className={styles.bubbleMeta}>
              {EMISOR_LABEL[m.emisor]} · {new Date(m.enviado_at).toLocaleString("es-AR")}
            </div>
          </div>
        ))}
      </div>

      <ReplyForm conversationId={conversation.id} />
    </div>
  )
}
