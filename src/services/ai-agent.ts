// Fase 10. Depende de ANTHROPIC_API_KEY (todavía no configurada, ver .env.example)
// y del catálogo con al menos algunos atributos confirmados (Fase 9).
//
// Implementa el árbol de decisión de la sección 8.1: clasifica la intención,
// consulta getConfirmedAttribute / getLatestCandidate (catalog-attributes.ts),
// y solo si no hay nada dispara una inferencia on-demand — nunca responde
// precio/stock desde acá, eso siempre sale de variantes/unidades directo.
//
// Modelo por defecto: claude-haiku-4-5 (el más económico) para clasificación
// y redacción de respuestas, incluidas recomendaciones — solo se sube a un
// modelo más capaz si la calidad no alcanza en la práctica (decisión del
// negocio, no un default de este servicio). Antes de llamar a Claude, revisar
// faq/knowledge_base con un match de texto simple — si ya está resuelto ahí,
// responder sin gastar tokens de IA.
//
// Presupuesto (sección 13.1): antes de cada llamada, sumar el gasto del mes
// desde ai_runs.tokens_entrada/tokens_salida. Si se acerca al tope que
// configure el negocio, no llamar a Claude — devolver nivelConfianza: 3 para
// que la conversación pase a intervención humana en vez de romperse.

export interface AgentDecision {
  nivelConfianza: 1 | 2 | 3
  respuesta: string | null
  fuentesConsultadas: Array<{ tabla: string; filtro: string }>
}

export async function handleIncomingMessage(): Promise<AgentDecision> {
  throw new Error("AIAgentService todavía no implementado — Fase 10")
}
