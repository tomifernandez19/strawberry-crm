import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync("/Users/tomasfernandez/strawberry-chats/.env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const TEST_EMAIL = "test-bandeja@strawberrytrejo.local"
const TEST_PASSWORD = "PruebaBandeja2026!"

const { data: created, error: userError } = await db.auth.admin.createUser({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  email_confirm: true,
})

if (userError && !userError.message.includes("already been registered")) {
  console.error("Error creando usuario:", userError)
  process.exit(1)
}

console.log("Usuario de prueba:", TEST_EMAIL, "/", TEST_PASSWORD)

const { data: modelo } = await db.from("modelos").select("id, descripcion").limit(1).single()
console.log("Modelo de ejemplo:", modelo)

const { data: customer, error: custErr } = await db
  .schema("atencion")
  .from("customers")
  .upsert({ whatsapp_wa_id: "wa_demo_1", telefono: "+5491122223333", nombre: "Julieta (prueba)" }, { onConflict: "whatsapp_wa_id" })
  .select("*")
  .single()
if (custErr) throw custErr

const { data: conversation, error: convErr } = await db
  .schema("atencion")
  .from("conversations")
  .upsert(
    { customer_id: customer.id, canal: "whatsapp", canal_thread_id: "wa_thread_demo_1", estado: "intervencion_humana" },
    { onConflict: "canal,canal_thread_id" }
  )
  .select("*")
  .single()
if (convErr) throw convErr

const { count } = await db
  .schema("atencion")
  .from("conversation_messages")
  .select("*", { count: "exact", head: true })
  .eq("conversation_id", conversation.id)

if (!count) {
  await db.schema("atencion").from("conversation_messages").insert([
    {
      conversation_id: conversation.id,
      emisor: "cliente",
      contenido: `Hola! ¿tenés la ${modelo?.descripcion ?? "Tiffany"} en stock?`,
      tipo_contenido: "texto",
      canal_message_id: "wamid.demo.1",
    },
    {
      conversation_id: conversation.id,
      emisor: "sistema",
      contenido: "Sin atributos confirmados para responder características — derivada a un humano (Nivel 3).",
      tipo_contenido: "texto",
    },
  ])
}

console.log("Conversación de prueba:", conversation.id)
