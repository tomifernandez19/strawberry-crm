"use client"

import { useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"

export default function LogoutButton() {
  const router = useRouter()

  return (
    <button
      onClick={async () => {
        await createBrowserSupabaseClient().auth.signOut()
        router.push("/login")
        router.refresh()
      }}
    >
      Salir
    </button>
  )
}
