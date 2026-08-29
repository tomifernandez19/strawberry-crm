import { createServiceClient } from "@/lib/supabase/server"
import { fetchInstagramProfile, instagramAdapter, verifyInstagramSignature } from "@/services/channels/instagram"
import { procesarEcoSaliente, procesarMensajeEntrante } from "@/services/inbound-message-handler"

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

// Mensajes entrantes reales. Clasificación por reglas sin IA (gratis) —
// ver rule-based-responder.ts. El agente de Claude de verdad es Fase 10.
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

  const db = createServiceClient()

  for (const msg of mensajes) {
    const perfil = await fetchInstagramProfile(msg.clienteIdentidad.psid!)
    await procesarMensajeEntrante(db, msg, perfil.nombre)
  }

  for (const eco of ecos) {
    await procesarEcoSaliente(db, eco)
  }

  // Meta reintenta si no devolvemos 200 rápido.
  return new Response("EVENT_RECEIVED", { status: 200 })
}
