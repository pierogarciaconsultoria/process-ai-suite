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
