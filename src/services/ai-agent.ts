// Fase 10. Depende de ANTHROPIC_API_KEY (todavía no configurada, ver .env.example)
// y del catálogo con al menos algunos atributos confirmados (Fase 9).
//
// Implementa el árbol de decisión de la sección 8.1: clasifica la intención,
// consulta getConfirmedAttribute / getLatestCandidate (catalog-attributes.ts),
// y solo si no hay nada dispara una inferencia on-demand — nunca responde
// precio/stock desde acá, eso siempre sale de variantes/unidades directo.

export interface AgentDecision {
  nivelConfianza: 1 | 2 | 3
  respuesta: string | null
  fuentesConsultadas: Array<{ tabla: string; filtro: string }>
}

export async function handleIncomingMessage(): Promise<AgentDecision> {
  throw new Error("AIAgentService todavía no implementado — Fase 10")
}
