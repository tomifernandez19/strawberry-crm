"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import styles from "./shell.module.css"

const TABS = [
  { href: "/bandeja", label: "Conversaciones" },
  { href: "/catalogo", label: "Catálogo" },
]

export default function NavTabs({ pendientes }: { pendientes: number }) {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
          >
            {tab.label}
            {tab.href === "/bandeja" && pendientes > 0 && <span className={styles.badge}>{pendientes}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
