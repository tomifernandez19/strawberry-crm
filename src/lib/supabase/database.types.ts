// Tipos de "public" generados desde el proyecto real (Supabase MCP: generate_typescript_types).
// Tipos de "atencion" escritos a mano a partir del DDL de la migración
// create_atencion_schema (ver documento de arquitectura, sección 7.1) — el
// generador de esta sesión no trae schemas no-"public" todavía. Cuando se
// instale el Supabase CLI (ver README), reemplazar este archivo por:
//   supabase gen types typescript --schema public,atencion --project-id rukdslcmxgmkiqxnplcs

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      modelos: {
        Row: {
          id: string
          codigo_proveedor: string | null
          descripcion: string
          marca: string | null
          categoria: string | null
          activo: boolean | null
          created_at: string | null
          tiendanube_id: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["modelos"]["Row"]> & { descripcion: string }
        Update: Partial<Database["public"]["Tables"]["modelos"]["Row"]>
        Relationships: []
      }
      variantes: {
        Row: {
          id: string
          modelo_id: string | null
          color: string
          talle: string
          costo_promedio: number | null
          created_at: string | null
          precio_efectivo: number | null
          precio_lista: number | null
          imagen_url: string | null
          pedido_pendiente: boolean | null
        }
        Insert: Partial<Database["public"]["Tables"]["variantes"]["Row"]> & { color: string; talle: string }
        Update: Partial<Database["public"]["Tables"]["variantes"]["Row"]>
        Relationships: []
      }
      unidades: {
        Row: {
          id: string
          codigo_qr: string | null
          variante_id: string | null
          estado: Database["public"]["Enums"]["unidad_estado"] | null
          fecha_ingreso: string | null
          fecha_venta: string | null
          compra_id: string | null
          venta_id: string | null
          created_at: string | null
          talle_especifico: string | null
          ubicacion: string | null
          en_vidriera: boolean | null
        }
        Insert: Partial<Database["public"]["Tables"]["unidades"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["unidades"]["Row"]>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: "PROPIETARIA" | "VENDEDOR" | null
          email: string | null
          nombre: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      unidad_estado:
        | "PENDIENTE_QR"
        | "DISPONIBLE"
        | "VENDIDO"
        | "RESERVADO_ONLINE"
        | "VENDIDO_ONLINE"
        | "FALLA"
    }
    CompositeTypes: Record<string, never>
  }
  atencion: {
    Tables: {
      customers: {
        Row: {
          id: string
          nombre: string | null
          telefono: string | null
          email: string | null
          whatsapp_wa_id: string | null
          instagram_psid: string | null
          messenger_psid: string | null
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["atencion"]["Tables"]["customers"]["Row"]>
        Update: Partial<Database["atencion"]["Tables"]["customers"]["Row"]>
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          customer_id: string
          canal: "whatsapp" | "instagram" | "messenger" | "mercado_libre"
          canal_thread_id: string | null
          estado:
            | "nueva"
            | "ia_respondiendo"
            | "requiere_aprobacion"
            | "intervencion_humana"
            | "cerrada"
          asignado_a: string | null
          nivel_confianza_actual: 1 | 2 | 3 | null
          ultima_interaccion_at: string
          cerrada_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["atencion"]["Tables"]["conversations"]["Row"]> & {
          customer_id: string
          canal: Database["atencion"]["Tables"]["conversations"]["Row"]["canal"]
        }
        Update: Partial<Database["atencion"]["Tables"]["conversations"]["Row"]>
        Relationships: []
      }
      conversation_messages: {
        Row: {
          id: string
          conversation_id: string
          emisor: "cliente" | "ia" | "humano" | "sistema"
          autor_id: string | null
          tipo_contenido: "texto" | "imagen" | "audio" | "documento" | "ubicacion"
          contenido: string | null
          media_url: string | null
          canal_message_id: string | null
          ai_run_id: string | null
          enviado_at: string
          created_at: string
        }
        Insert: Partial<Database["atencion"]["Tables"]["conversation_messages"]["Row"]> & {
          conversation_id: string
          emisor: Database["atencion"]["Tables"]["conversation_messages"]["Row"]["emisor"]
        }
        Update: Partial<Database["atencion"]["Tables"]["conversation_messages"]["Row"]>
        Relationships: []
      }
      knowledge_base: {
        Row: {
          id: string
          tema: string
          titulo: string
          contenido: string
          version: number
          estado: "activo" | "archivado"
          creado_por: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["atencion"]["Tables"]["knowledge_base"]["Row"]> & {
          tema: string
          titulo: string
          contenido: string
        }
        Update: Partial<Database["atencion"]["Tables"]["knowledge_base"]["Row"]>
        Relationships: []
      }
      faq: {
        Row: {
          id: string
          pregunta: string
          respuesta: string
          tema: string | null
          activo: boolean
          veces_utilizada: number
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["atencion"]["Tables"]["faq"]["Row"]> & {
          pregunta: string
          respuesta: string
        }
        Update: Partial<Database["atencion"]["Tables"]["faq"]["Row"]>
        Relationships: []
      }
      product_attribute_candidates: {
        Row: {
          id: string
          modelo_id: string
          atributo: string
          valor_propuesto: string
          origen_inferencia:
            | "texto_descripcion"
            | "texto_tienda_nube"
            | "texto_mercado_libre"
            | "imagen"
          fuente_detalle: string | null
          confianza_ia: number | null
          estado: "pendiente_confirmacion" | "aprobado" | "rechazado"
          revisado_por: string | null
          revisado_at: string | null
          notas_revision: string | null
          created_at: string
        }
        Insert: Partial<Database["atencion"]["Tables"]["product_attribute_candidates"]["Row"]> & {
          modelo_id: string
          atributo: string
          valor_propuesto: string
          origen_inferencia: Database["atencion"]["Tables"]["product_attribute_candidates"]["Row"]["origen_inferencia"]
        }
        Update: Partial<Database["atencion"]["Tables"]["product_attribute_candidates"]["Row"]>
        Relationships: []
      }
      product_attributes: {
        Row: {
          id: string
          modelo_id: string
          atributo: string
          valor: string
          fuente: "manual" | "erp" | "tienda_nube" | "mercado_libre" | "ia_aprobada"
          candidata_origen_id: string | null
          confirmado_por: string | null
          vigente: boolean
          created_at: string
        }
        Insert: Partial<Database["atencion"]["Tables"]["product_attributes"]["Row"]> & {
          modelo_id: string
          atributo: string
          valor: string
          fuente: Database["atencion"]["Tables"]["product_attributes"]["Row"]["fuente"]
        }
        Update: Partial<Database["atencion"]["Tables"]["product_attributes"]["Row"]>
        Relationships: []
      }
      ai_runs: {
        Row: {
          id: string
          tipo:
            | "respuesta_conversacion"
            | "clasificacion_intencion"
            | "propuesta_atributo"
            | "recomendacion_producto"
          conversation_message_id: string | null
          modelo_id: string | null
          intencion_clasificada: string | null
          nivel_confianza: 1 | 2 | 3 | null
          fuentes_consultadas: Json
          respuesta_generada: string | null
          modelo_ia: string
          tokens_entrada: number | null
          tokens_salida: number | null
          created_at: string
        }
        Insert: Partial<Database["atencion"]["Tables"]["ai_runs"]["Row"]> & {
          tipo: Database["atencion"]["Tables"]["ai_runs"]["Row"]["tipo"]
          modelo_ia: string
        }
        Update: Partial<Database["atencion"]["Tables"]["ai_runs"]["Row"]>
        Relationships: []
      }
      learned_answers: {
        Row: {
          id: string
          conversation_message_id: string | null
          pregunta_original: string
          contexto: string | null
          respuesta_final: string
          modelo_id: string | null
          canal: string | null
          estado: "pendiente" | "aprobada" | "rechazada"
          aprobado_por: string | null
          veces_reutilizada: number
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["atencion"]["Tables"]["learned_answers"]["Row"]> & {
          pregunta_original: string
          respuesta_final: string
        }
        Update: Partial<Database["atencion"]["Tables"]["learned_answers"]["Row"]>
        Relationships: []
      }
      human_approvals: {
        Row: {
          id: string
          entidad_tipo: "ai_run" | "attribute_candidate" | "learned_answer"
          entidad_id: string
          usuario_id: string
          decision: "aprobado" | "editado" | "rechazado"
          contenido_editado: string | null
          comentario: string | null
          decidido_at: string
        }
        Insert: Partial<Database["atencion"]["Tables"]["human_approvals"]["Row"]> & {
          entidad_tipo: Database["atencion"]["Tables"]["human_approvals"]["Row"]["entidad_tipo"]
          entidad_id: string
          usuario_id: string
          decision: Database["atencion"]["Tables"]["human_approvals"]["Row"]["decision"]
        }
        Update: Partial<Database["atencion"]["Tables"]["human_approvals"]["Row"]>
        Relationships: []
      }
      respuestas_programadas: {
        Row: {
          id: string
          conversation_id: string
          conversation_message_id: string | null
          contenido: string
          clasificacion: "precio" | "stock" | "faq" | "aprendida" | "desconocido"
          enviar_en: string
          enviado: boolean
          created_at: string
        }
        Insert: Partial<Database["atencion"]["Tables"]["respuestas_programadas"]["Row"]> & {
          conversation_id: string
          contenido: string
          clasificacion: Database["atencion"]["Tables"]["respuestas_programadas"]["Row"]["clasificacion"]
          enviar_en: string
        }
        Update: Partial<Database["atencion"]["Tables"]["respuestas_programadas"]["Row"]>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
