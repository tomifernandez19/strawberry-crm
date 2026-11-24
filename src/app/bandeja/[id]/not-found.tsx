import Link from "next/link"
import styles from "../bandeja.module.css"

// Un aviso o link viejo puede apuntar a una conversación que ya no existe.
export default function ConversacionNoEncontrada() {
  return (
    <div className={styles.emptyState}>
      <p>Esa conversación ya no existe (se borró o el link es viejo).</p>
      <Link href="/bandeja" className={styles.backLink}>
        Ir a las conversaciones
      </Link>
    </div>
  )
}
