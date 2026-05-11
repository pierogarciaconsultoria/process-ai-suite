export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      chamado_mensagens: {
        Row: {
          anexo_url: string | null
          chamado_id: string
          conteudo: string
          created_at: string
          empresa_id: string
          id: string
          user_id: string
        }
        Insert: {
          anexo_url?: string | null
          chamado_id: string
          conteudo: string
          created_at?: string
          empresa_id: string
          id?: string
          user_id: string
        }
        Update: {
          anexo_url?: string | null
          chamado_id?: string
          conteudo?: string
          created_at?: string
          empresa_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamado_mensagens_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_mensagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados: {
        Row: {
          anexo_url: string | null
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          status: string
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anexo_url?: string | null
          created_at?: string
          descricao: string
          empresa_id: string
          id?: string
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anexo_url?: string | null
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      convites: {
        Row: {
          created_at: string
          email: string
          empresa_id: string
          id: string
          perfil: string
          status: string
          token: string | null
        }
        Insert: {
          created_at?: string
          email: string
          empresa_id: string
          id?: string
          perfil: string
          status: string
          token?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          empresa_id?: string
          id?: string
          perfil?: string
          status?: string
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convites_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          area_atuacao: string | null
          contexto: string | null
          created_at: string
          id: string
          nome: string
          owner_id: string
          segmento: string | null
          tamanho: string | null
        }
        Insert: {
          area_atuacao?: string | null
          contexto?: string | null
          created_at?: string
          id?: string
          nome: string
          owner_id: string
          segmento?: string | null
          tamanho?: string | null
        }
        Update: {
          area_atuacao?: string | null
          contexto?: string | null
          created_at?: string
          id?: string
          nome?: string
          owner_id?: string
          segmento?: string | null
          tamanho?: string | null
        }
        Relationships: []
      }
      ai_configurations: {
        Row: {
          company_id: string
          config_type: string
          content: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          config_type: string
          content: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          config_type?: string
          content?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_configurations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          company_id: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json
          process_id: string | null
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          company_id: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json
          process_id?: string | null
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          company_id?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          process_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_generation_settings: {
        Row: {
          approval_role: string | null
          auto_publish_after_approval: boolean
          company_id: string
          created_at: string
          default_template_id: string | null
          id: string
          require_approval: boolean
          review_period_days: number
          updated_at: string
          versioning_enabled: boolean
        }
        Insert: {
          approval_role?: string | null
          auto_publish_after_approval?: boolean
          company_id: string
          created_at?: string
          default_template_id?: string | null
          id?: string
          require_approval?: boolean
          review_period_days?: number
          updated_at?: string
          versioning_enabled?: boolean
        }
        Update: {
          approval_role?: string | null
          auto_publish_after_approval?: boolean
          company_id?: string
          created_at?: string
          default_template_id?: string | null
          id?: string
          require_approval?: boolean
          review_period_days?: number
          updated_at?: string
          versioning_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "document_generation_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_generation_settings_default_template_id_fkey"
            columns: ["default_template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_template_prompts: {
        Row: {
          company_id: string | null
          created_at: string
          detail_level: string | null
          generation_instructions: string | null
          id: string
          include_action_plan: boolean
          include_checklist: boolean
          include_improvements: boolean
          include_indicators: boolean
          include_risks: boolean
          prompt_type: string
          system_prompt: string | null
          target_audience: string | null
          template_id: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          detail_level?: string | null
          generation_instructions?: string | null
          id?: string
          include_action_plan?: boolean
          include_checklist?: boolean
          include_improvements?: boolean
          include_indicators?: boolean
          include_risks?: boolean
          prompt_type?: string
          system_prompt?: string | null
          target_audience?: string | null
          template_id: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          detail_level?: string | null
          generation_instructions?: string | null
          id?: string
          include_action_plan?: boolean
          include_checklist?: boolean
          include_improvements?: boolean
          include_indicators?: boolean
          include_risks?: boolean
          prompt_type?: string
          system_prompt?: string | null
          target_audience?: string | null
          template_id?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_template_prompts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_template_prompts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_template_sections: {
        Row: {
          allows_attachments: boolean
          company_id: string | null
          created_at: string
          generated_by_ai: boolean
          id: string
          include_in_ai_indexing: boolean
          include_in_final_document: boolean
          is_active: boolean
          is_required: boolean
          section_description: string | null
          section_key: string
          section_title: string
          sort_order: number
          source_type: string
          template_id: string
          updated_at: string
        }
        Insert: {
          allows_attachments?: boolean
          company_id?: string | null
          created_at?: string
          generated_by_ai?: boolean
          id?: string
          include_in_ai_indexing?: boolean
          include_in_final_document?: boolean
          is_active?: boolean
          is_required?: boolean
          section_description?: string | null
          section_key: string
          section_title: string
          sort_order?: number
          source_type?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          allows_attachments?: boolean
          company_id?: string | null
          created_at?: string
          generated_by_ai?: boolean
          id?: string
          include_in_ai_indexing?: boolean
          include_in_final_document?: boolean
          is_active?: boolean
          is_required?: boolean
          section_description?: string | null
          section_key?: string
          section_title?: string
          sort_order?: number
          source_type?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_template_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_template_variables: {
        Row: {
          company_id: string | null
          created_at: string
          data_type: string | null
          example_value: string | null
          id: string
          is_required: boolean
          source_field: string | null
          template_id: string
          updated_at: string
          variable_description: string | null
          variable_key: string
          variable_label: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          data_type?: string | null
          example_value?: string | null
          id?: string
          is_required?: boolean
          source_field?: string | null
          template_id: string
          updated_at?: string
          variable_description?: string | null
          variable_key: string
          variable_label: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          data_type?: string | null
          example_value?: string | null
          id?: string
          is_required?: boolean
          source_field?: string | null
          template_id?: string
          updated_at?: string
          variable_description?: string | null
          variable_key?: string
          variable_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_template_variables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_template_variables_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          description: string | null
          document_type: string
          id: string
          is_active: boolean
          is_default: boolean
          is_system_template: boolean
          name: string
          updated_at: string
          version: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          document_type: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_system_template?: boolean
          name: string
          updated_at?: string
          version?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          document_type?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_system_template?: boolean
          name?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_document_attachments: {
        Row: {
          company_id: string
          created_at: string
          document_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string
        }
        Insert: {
          company_id: string
          created_at?: string
          document_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_document_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_document_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_document_versions: {
        Row: {
          change_summary: string | null
          company_id: string
          content_markdown: string
          content_text: string | null
          created_at: string
          created_by: string
          document_id: string
          id: string
          version: string
        }
        Insert: {
          change_summary?: string | null
          company_id: string
          content_markdown: string
          content_text?: string | null
          created_at?: string
          created_by: string
          document_id: string
          id?: string
          version: string
        }
        Update: {
          change_summary?: string | null
          company_id?: string
          content_markdown?: string
          content_text?: string | null
          created_at?: string
          created_by?: string
          document_id?: string
          id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_document_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          ai_model: string | null
          ai_prompt_used: string | null
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          company_id: string
          content_markdown: string
          content_text: string | null
          created_at: string
          created_by: string
          description_input: string | null
          document_origin: string
          document_type: string
          generation_metadata: Json
          id: string
          process_id: string | null
          process_mapping_id: string | null
          published_at: string | null
          status: string
          template_id: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          ai_model?: string | null
          ai_prompt_used?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          company_id: string
          content_markdown: string
          content_text?: string | null
          created_at?: string
          created_by: string
          description_input?: string | null
          document_origin: string
          document_type: string
          generation_metadata?: Json
          id?: string
          process_id?: string | null
          process_mapping_id?: string | null
          published_at?: string | null
          status?: string
          template_id: string
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          ai_model?: string | null
          ai_prompt_used?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          company_id?: string
          content_markdown?: string
          content_text?: string | null
          created_at?: string
          created_by?: string
          description_input?: string | null
          document_origin?: string
          document_type?: string
          generation_metadata?: Json
          id?: string
          process_id?: string | null
          process_mapping_id?: string | null
          published_at?: string | null
          status?: string
          template_id?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          applied: boolean
          created_at: string
          empresa_id: string | null
          form_snapshot: Json
          id: string
          messages: Json
          progress: number
          reason: string
          user_id: string
        }
        Insert: {
          applied?: boolean
          created_at?: string
          empresa_id?: string | null
          form_snapshot?: Json
          id?: string
          messages: Json
          progress?: number
          reason: string
          user_id: string
        }
        Update: {
          applied?: boolean
          created_at?: string
          empresa_id?: string | null
          form_snapshot?: Json
          id?: string
          messages?: Json
          progress?: number
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      membros: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          invited_by: string | null
          perfil: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          invited_by?: string | null
          perfil: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          invited_by?: string | null
          perfil?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_empresa_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
