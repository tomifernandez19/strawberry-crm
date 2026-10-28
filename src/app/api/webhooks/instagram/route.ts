import { after } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { fetchInstagramProfile, instagramAdapter, verifyInstagramSignature } from "@/services/channels/instagram"
import { procesarEcoSaliente, procesarMensajeEntrante } from "@/services/inbound-message-handler"

// El agente de IA puede tardar 10–15 s: se responde 200 enseguida (Meta
// reintenta y duplica si tarda) y el trabajo sigue en segundo plano.
export const maxDuration = 60

// Handshake de verificación: Meta lo llama una vez al configurar el webhook.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const challenge = instagramAdapter.verifyWebhook({
    mode: url.searchParams.get("hub.mode") ?? undefined,
    token: url.searchParams.get("hub.verify_token") ?? undefined,
    challenge: url.searchParams.get("hub.challenge") ?? undefined,
  })

  if (!challenge) return new Response("Forbidden", { status: 403 })
  return new Response(challenge, { status: 200 })
}

// Mensajes entrantes reales. Los procesa inbound-message-handler.ts (IA o
// reglas, según el modo en atencion.ajustes).
export async function POST(request: Request) {
  const rawBody = await request.text()

  if (!verifyInstagramSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 403 })
  }

  const payload = JSON.parse(rawBody)
  const { mensajes, ecos } = instagramAdapter.parseWebhookPayload(payload)

  if (mensajes.length === 0 && ecos.length === 0) {
    // El formato "messaging" ya se confirmó contra un mensaje real — esto
    // queda como red de seguridad por si Meta manda alguna variante rara.
    console.log("Webhook de Instagram sin nada parseado. Payload crudo:", rawBody)
  }

  after(async () => {
    const db = createServiceClient()

    for (const msg of mensajes) {
      try {
        const perfil = await fetchInstagramProfile(msg.clienteIdentidad.psid!)
        await procesarMensajeEntrante(db, msg, perfil.nombre)
      } catch (err) {
        console.error("Error procesando mensaje entrante de Instagram:", err)
      }
    }

    for (const eco of ecos) {
      try {
        await procesarEcoSaliente(db, eco)
      } catch (err) {
        console.error("Error procesando eco de Instagram:", err)
      }
    }
  })

  // Meta reintenta si no devolvemos 200 rápido.
  return new Response("EVENT_RECEIVED", { status: 200 })
}
