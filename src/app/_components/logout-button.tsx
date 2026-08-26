"use client"

import { useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import styles from "./shell.module.css"

export default function LogoutButton() {
  const router = useRouter()

  return (
    <button
      className={styles.logoutButton}
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
