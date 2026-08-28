import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/supabase/session"

const GRAPH_API_VERSION = "v21.0"

// Paso único de setup (Fase 12 — Instagram/Messenger). Recibe un User Access
// Token de corta duración (sacado a mano de Graph API Explorer) y hace, del
// lado del servidor, el intercambio por uno de larga duración + la búsqueda
// del Page Access Token — nunca guarda nada, solo lo muestra para copiar.
export async function POST(request: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { appId, shortLivedToken } = await request.json()
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  if (!appId || !shortLivedToken) {
    return NextResponse.json({ error: "Falta appId o shortLivedToken" }, { status: 400 })
  }
  if (!appSecret) {
    return NextResponse.json({ error: "Falta INSTAGRAM_APP_SECRET en el entorno" }, { status: 500 })
  }

  const exchangeUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`)
  exchangeUrl.searchParams.set("grant_type", "fb_exchange_token")
  exchangeUrl.searchParams.set("client_id", appId)
  exchangeUrl.searchParams.set("client_secret", appSecret)
  exchangeUrl.searchParams.set("fb_exchange_token", shortLivedToken)

  const exchangeRes = await fetch(exchangeUrl)
  const exchangeData = await exchangeRes.json()
  if (!exchangeRes.ok) {
    return NextResponse.json({ error: "Meta rechazó el intercambio", detail: exchangeData }, { status: 502 })
  }
  const longLivedUserToken = exchangeData.access_token as string

  const accountsUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts`)
  accountsUrl.searchParams.set("access_token", longLivedUserToken)
  accountsUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account{id,username}")

  const accountsRes = await fetch(accountsUrl)
  const accountsData = await accountsRes.json()
  if (!accountsRes.ok) {
    return NextResponse.json({ error: "No se pudieron listar las páginas", detail: accountsData }, { status: 502 })
  }

  const paginas = (accountsData.data ?? []).map(
    (p: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } }) => ({
      pageId: p.id,
      pageName: p.name,
      pageAccessToken: p.access_token,
      instagramAccountId: p.instagram_business_account?.id ?? null,
      instagramUsername: p.instagram_business_account?.username ?? null,
    })
  )

  return NextResponse.json({ paginas })
}
