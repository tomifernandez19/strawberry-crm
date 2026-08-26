import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/supabase/session"
import LogoutButton from "./logout-button"
import NavTabs from "./nav-tabs"
import styles from "./shell.module.css"

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <strong>Strawberry Trejo</strong>
          <NavTabs />
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
