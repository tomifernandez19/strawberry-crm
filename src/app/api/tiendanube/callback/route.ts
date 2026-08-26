import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"

// Recibe el "code" que Tienda Nube manda después de que autorizás la app
// (paso único de setup, Fase 8). Lo cambia por un access_token y lo muestra
// en pantalla para copiarlo a mano a las variables de entorno — no se
// guarda en ningún lado automáticamente, mismo criterio que las otras keys.
export async function GET(request: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const code = new URL(request.url).searchParams.get("code")
  if (!code) return NextResponse.json({ error: "Falta el parámetro code" }, { status: 400 })

  const clientId = process.env.TIENDANUBE_CLIENT_ID
  const clientSecret = process.env.TIENDANUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Faltan TIENDANUBE_CLIENT_ID/TIENDANUBE_CLIENT_SECRET en el entorno" },
      { status: 500 }
    )
  }

  const response = await fetch("https://www.tiendanube.com/apps/authorize/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    return NextResponse.json({ error: "Tienda Nube rechazó el código", detail: data }, { status: 502 })
  }

  return new Response(
    `<!doctype html><html><body style="font-family: system-ui; max-width: 600px; margin: 60px auto;">
      <h1>Autorización completa</h1>
      <p>Copiá estos dos valores a <code>TIENDANUBE_ACCESS_TOKEN</code> y confirmá que <code>TIENDANUBE_STORE_ID</code> coincide, tanto en <code>.env.local</code> como en las variables de entorno de Vercel:</p>
      <p><strong>access_token:</strong> <code>${data.access_token}</code></p>
      <p><strong>store_id (user_id):</strong> <code>${data.user_id}</code></p>
      <p style="color:#8b7a7e">Esta página no guarda nada — cerrala después de copiar los valores.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  )
}
