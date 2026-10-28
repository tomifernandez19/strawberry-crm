import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type Db = SupabaseClient<Database>

const URL_APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://strawberry-crm.vercel.app"

// Aviso push al celular del equipo vía ntfy.sh. El nombre del "tema" es el
// secreto (vive en atencion.ajustes, no en el código). A propósito NO se
// manda el texto del mensaje ni el motivo: ntfy.sh es un servidor público,
// así que solo viaja el nombre de la clienta y el tipo de aviso.
export async function avisarEquipo(
  db: Db,
  params: { conversationId: string; titulo: string; mensaje: string }
): Promise<void> {
  try {
    const { data } = await db.schema("atencion").from("ajustes").select("valor").eq("clave", "ntfy_topic").maybeSingle()
    const topic = typeof data?.valor === "string" ? data.valor : null
    if (!topic) return

    await fetch("https://ntfy.sh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        title: params.titulo,
        message: params.mensaje,
        click: `${URL_APP}/bandeja/${params.conversationId}`,
        priority: 4,
        tags: ["bell"],
      }),
      signal: AbortSignal.timeout(4000),
    })
  } catch (err) {
    // Un aviso que falla nunca debe romper el procesamiento del mensaje.
    console.error("No se pudo enviar el aviso ntfy:", err)
  }
}
