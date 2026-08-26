import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/supabase/session"
import LogoutButton from "./logout-button"
import styles from "./bandeja.module.css"

export default async function BandejaLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <strong>Strawberry Trejo</strong> · Bandeja de atención
        </div>
        <div className={styles.headerRight}>
          <span>{profile.nombre ?? profile.email}</span>
          <span className={styles.role}>{profile.role}</span>
          <LogoutButton />
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
