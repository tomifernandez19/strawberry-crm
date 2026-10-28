import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/supabase/session"
import { createServiceClient } from "@/lib/supabase/server"
import AutoRefresh from "./auto-refresh"
import LogoutButton from "./logout-button"
import NavTabs from "./nav-tabs"
import styles from "./shell.module.css"

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  const { count } = await createServiceClient()
    .schema("atencion")
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .in("estado", ["intervencion_humana", "requiere_aprobacion"])
  const pendientes = count ?? 0

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <strong>Strawberry Trejo</strong>
          <NavTabs pendientes={pendientes} />
        </div>
        <div className={styles.headerRight}>
          <span>{profile.nombre ?? profile.email}</span>
          <span className={styles.role}>{profile.role}</span>
          <LogoutButton />
        </div>
      </header>
      <AutoRefresh pendientes={pendientes} />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
