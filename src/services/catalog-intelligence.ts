// Fase 9. Depende de las credenciales de Tienda Nube (tienda-nube.ts) y de
// ANTHROPIC_API_KEY para el análisis de texto/imagen (sección 9).
//
// analyzeModelo corre en lote (job programado o manual) o "on-demand" para
// un solo modelo+atributo puntual, disparado por ai-agent.ts cuando una
// pregunta no tiene ni atributo confirmado ni candidato (sección 8.1).

export interface AttributeProposal {
  atributo: string
  valorPropuesto: string
  origenInferencia: "texto_descripcion" | "texto_tienda_nube" | "texto_mercado_libre" | "imagen"
}

export async function analyzeModelo(): Promise<AttributeProposal[]> {
  throw new Error("CatalogIntelligenceService todavía no implementado — Fase 9")
}
