"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

// Mantiene la bandeja al día sin tener que recargar a mano, y muestra en la
// pestaña del navegador cuántas conversaciones esperan al equipo.
export default function AutoRefresh({ pendientes }: { pendientes: number }) {
  const router = useRouter()

  useEffect(() => {
    document.title = pendientes > 0 ? `(${pendientes}) Strawberry Trejo` : "Strawberry Trejo"
  }, [pendientes])

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh()
    }, 30_000)
    return () => clearInterval(id)
  }, [router])

  return null
}
