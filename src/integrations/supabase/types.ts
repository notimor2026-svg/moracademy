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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          accion: string
          actor_id: string | null
          created_at: string
          entidad: string | null
          entidad_id: string | null
          id: string
          payload: Json | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          created_at?: string
          entidad?: string | null
          entidad_id?: string | null
          id?: string
          payload?: Json | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          created_at?: string
          entidad?: string | null
          entidad_id?: string | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          descripcion: string | null
          icono: string | null
          id: string
          nombre: string
          slug: string
        }
        Insert: {
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre: string
          slug: string
        }
        Update: {
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          assignment_id: string
          codigo: string
          course_id: string
          employee_id: string
          fecha_emision: string
          id: string
          nota: number
        }
        Insert: {
          assignment_id: string
          codigo: string
          course_id: string
          employee_id: string
          fecha_emision?: string
          id?: string
          nota: number
        }
        Update: {
          assignment_id?: string
          codigo?: string
          course_id?: string
          employee_id?: string
          fecha_emision?: string
          id?: string
          nota?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificates_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "course_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      closed_requisitions: {
        Row: {
          area: string
          capacitaciones_induccion: Json
          cargo: string
          codigo: string
          created_at: string
          fecha_cierre: string
          id: string
        }
        Insert: {
          area: string
          capacitaciones_induccion?: Json
          cargo: string
          codigo: string
          created_at?: string
          fecha_cierre?: string
          id?: string
        }
        Update: {
          area?: string
          capacitaciones_induccion?: Json
          cargo?: string
          codigo?: string
          created_at?: string
          fecha_cierre?: string
          id?: string
        }
        Relationships: []
      }
      course_assignments: {
        Row: {
          course_id: string
          employee_id: string
          estado: string
          fecha_asignacion: string
          fecha_finalizacion: string | null
          fecha_vencimiento: string | null
          id: string
          intentos_consumidos: number
          mejor_nota: number | null
          origen: string
          requisicion_id: string | null
        }
        Insert: {
          course_id: string
          employee_id: string
          estado?: string
          fecha_asignacion?: string
          fecha_finalizacion?: string | null
          fecha_vencimiento?: string | null
          id?: string
          intentos_consumidos?: number
          mejor_nota?: number | null
          origen?: string
          requisicion_id?: string | null
        }
        Update: {
          course_id?: string
          employee_id?: string
          estado?: string
          fecha_asignacion?: string
          fecha_finalizacion?: string | null
          fecha_vencimiento?: string | null
          id?: string
          intentos_consumidos?: number
          mejor_nota?: number | null
          origen?: string
          requisicion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assignments_requisicion_id_fkey"
            columns: ["requisicion_id"]
            isOneToOne: false
            referencedRelation: "closed_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          contenido: string | null
          course_id: string
          created_at: string
          duracion_min: number | null
          id: string
          modulo: string | null
          obligatorio: boolean
          orden: number
          seccion: string | null
          storage_path: string | null
          text_excerpt: string | null
          tipo: string
          titulo: string
          url_externa: string | null
        }
        Insert: {
          contenido?: string | null
          course_id: string
          created_at?: string
          duracion_min?: number | null
          id?: string
          modulo?: string | null
          obligatorio?: boolean
          orden?: number
          seccion?: string | null
          storage_path?: string | null
          text_excerpt?: string | null
          tipo?: string
          titulo: string
          url_externa?: string | null
        }
        Update: {
          contenido?: string | null
          course_id?: string
          created_at?: string
          duracion_min?: number | null
          id?: string
          modulo?: string | null
          obligatorio?: boolean
          orden?: number
          seccion?: string | null
          storage_path?: string | null
          text_excerpt?: string | null
          tipo?: string
          titulo?: string
          url_externa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          abierto_a_todos: boolean
          area: string | null
          cargo: string | null
          cover_color: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          duracion_min: number | null
          estado: string
          id: string
          intentos_max: number
          nombre: string
          nota_minima: number
          permite_certificado: boolean
          requiere_aprobacion_manual: boolean
          tipo: string
          updated_at: string
          vigencia_dias: number | null
        }
        Insert: {
          abierto_a_todos?: boolean
          area?: string | null
          cargo?: string | null
          cover_color?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          duracion_min?: number | null
          estado?: string
          id?: string
          intentos_max?: number
          nombre: string
          nota_minima?: number
          permite_certificado?: boolean
          requiere_aprobacion_manual?: boolean
          tipo?: string
          updated_at?: string
          vigencia_dias?: number | null
        }
        Update: {
          abierto_a_todos?: boolean
          area?: string | null
          cargo?: string | null
          cover_color?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          duracion_min?: number | null
          estado?: string
          id?: string
          intentos_max?: number
          nombre?: string
          nota_minima?: number
          permite_certificado?: boolean
          requiere_aprobacion_manual?: boolean
          tipo?: string
          updated_at?: string
          vigencia_dias?: number | null
        }
        Relationships: []
      }
      employee_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          employee_id: string
          id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          employee_id: string
          id?: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_badges_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          area: string | null
          auth_user_id: string | null
          cargo: string | null
          created_at: string
          dui: string
          email: string | null
          estado: string
          fecha_ingreso: string | null
          id: string
          jefe_id: string | null
          nombre: string
          requisicion_id: string | null
          tipo_proceso: string
          updated_at: string
          xp: number
        }
        Insert: {
          area?: string | null
          auth_user_id?: string | null
          cargo?: string | null
          created_at?: string
          dui: string
          email?: string | null
          estado?: string
          fecha_ingreso?: string | null
          id?: string
          jefe_id?: string | null
          nombre: string
          requisicion_id?: string | null
          tipo_proceso?: string
          updated_at?: string
          xp?: number
        }
        Update: {
          area?: string | null
          auth_user_id?: string | null
          cargo?: string | null
          created_at?: string
          dui?: string
          email?: string | null
          estado?: string
          fecha_ingreso?: string | null
          id?: string
          jefe_id?: string | null
          nombre?: string
          requisicion_id?: string | null
          tipo_proceso?: string
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "employees_jefe_id_fkey"
            columns: ["jefe_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_requisicion_id_fkey"
            columns: ["requisicion_id"]
            isOneToOne: false
            referencedRelation: "closed_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completado: boolean
          completed_at: string | null
          employee_id: string
          id: string
          lesson_id: string
        }
        Insert: {
          completado?: boolean
          completed_at?: string | null
          employee_id: string
          id?: string
          lesson_id: string
        }
        Update: {
          completado?: boolean
          completed_at?: string | null
          employee_id?: string
          id?: string
          lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_outbox: {
        Row: {
          created_at: string
          destinatario: string | null
          id: string
          payload: Json | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          destinatario?: string | null
          id?: string
          payload?: Json | null
          status?: string
          tipo: string
        }
        Update: {
          created_at?: string
          destinatario?: string | null
          id?: string
          payload?: Json | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          aprobado: boolean | null
          employee_id: string
          finished_at: string | null
          id: string
          intento_num: number
          preguntas: Json
          quiz_id: string
          respuestas: Json | null
          score: number | null
          started_at: string
        }
        Insert: {
          aprobado?: boolean | null
          employee_id: string
          finished_at?: string | null
          id?: string
          intento_num?: number
          preguntas?: Json
          quiz_id: string
          respuestas?: Json | null
          score?: number | null
          started_at?: string
        }
        Update: {
          aprobado?: boolean | null
          employee_id?: string
          finished_at?: string | null
          id?: string
          intento_num?: number
          preguntas?: Json
          quiz_id?: string
          respuestas?: Json | null
          score?: number | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          bloquea_avance: boolean
          course_id: string
          created_at: string
          es_final: boolean
          id: string
          intentos_permitidos: number
          lesson_id: string | null
          nombre: string
          num_preguntas: number
          posicion: number
          preguntas: Json
          umbral: number
        }
        Insert: {
          bloquea_avance?: boolean
          course_id: string
          created_at?: string
          es_final?: boolean
          id?: string
          intentos_permitidos?: number
          lesson_id?: string | null
          nombre?: string
          num_preguntas?: number
          posicion?: number
          preguntas?: Json
          umbral?: number
        }
        Update: {
          bloquea_avance?: boolean
          course_id?: string
          created_at?: string
          es_final?: boolean
          id?: string
          intentos_permitidos?: number
          lesson_id?: string | null
          nombre?: string
          num_preguntas?: number
          posicion?: number
          preguntas?: Json
          umbral?: number
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reports: {
        Row: {
          config: Json
          created_at: string
          entidad: string
          id: string
          nombre: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          entidad: string
          id?: string
          nombre: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          entidad?: string
          id?: string
          nombre?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_employee_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_of: { Args: { _employee_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "colaborador" | "rrhh" | "jefe_directo" | "super_admin"
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
    Enums: {
      app_role: ["colaborador", "rrhh", "jefe_directo", "super_admin"],
    },
  },
} as const
