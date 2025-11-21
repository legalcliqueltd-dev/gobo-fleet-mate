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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          driver_limit: number
          features: Json | null
          id: string
          plan_name: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          driver_limit?: number
          features?: Json | null
          id?: string
          plan_name?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          driver_limit?: number
          features?: Json | null
          id?: string
          plan_name?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          connected_at: string | null
          connected_driver_id: string | null
          connection_code: string | null
          created_at: string | null
          id: string
          imei: string | null
          is_temporary: boolean | null
          last_notified_offline_at: string | null
          name: string | null
          status: string | null
          status_changed_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          connected_driver_id?: string | null
          connection_code?: string | null
          created_at?: string | null
          id?: string
          imei?: string | null
          is_temporary?: boolean | null
          last_notified_offline_at?: string | null
          name?: string | null
          status?: string | null
          status_changed_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          connected_driver_id?: string | null
          connection_code?: string | null
          created_at?: string | null
          id?: string
          imei?: string | null
          is_temporary?: boolean | null
          last_notified_offline_at?: string | null
          name?: string | null
          status?: string | null
          status_changed_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      driver_connections: {
        Row: {
          admin_user_id: string
          connected_at: string | null
          created_at: string
          driver_user_id: string
          id: string
          invited_at: string | null
          status: string
        }
        Insert: {
          admin_user_id: string
          connected_at?: string | null
          created_at?: string
          driver_user_id: string
          id?: string
          invited_at?: string | null
          status?: string
        }
        Update: {
          admin_user_id?: string
          connected_at?: string | null
          created_at?: string
          driver_user_id?: string
          id?: string
          invited_at?: string | null
          status?: string
        }
        Relationships: []
      }
      geofences: {
        Row: {
          coordinates: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          radius_m: number | null
          type: string
          updated_at: string
        }
        Insert: {
          coordinates: Json
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          radius_m?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          coordinates?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          radius_m?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          device_id: string
          id: number
          latitude: number
          longitude: number
          speed: number | null
          timestamp: string
        }
        Insert: {
          device_id: string
          id?: number
          latitude: number
          longitude: number
          speed?: number | null
          timestamp?: string
        }
        Update: {
          device_id?: string
          id?: number
          latitude?: number
          longitude?: number
          speed?: number | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_tokens: {
        Row: {
          created_at: string | null
          id: string
          last_seen_at: string | null
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      sos_events: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string | null
          device_id: string | null
          hazard: string | null
          id: string
          latitude: number | null
          longitude: number | null
          message: string | null
          photo_url: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_note: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string | null
          device_id?: string | null
          hazard?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          message?: string | null
          photo_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_note?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string | null
          device_id?: string | null
          hazard?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          message?: string | null
          photo_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_note?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sos_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      sos_position_updates: {
        Row: {
          id: string
          latitude: number
          longitude: number
          sos_event_id: string
          timestamp: string | null
        }
        Insert: {
          id?: string
          latitude: number
          longitude: number
          sos_event_id: string
          timestamp?: string | null
        }
        Update: {
          id?: string
          latitude?: number
          longitude?: number
          sos_event_id?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sos_position_updates_sos_event_id_fkey"
            columns: ["sos_event_id"]
            isOneToOne: false
            referencedRelation: "sos_events"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reports: {
        Row: {
          created_at: string | null
          delivered: boolean
          distance_to_dropoff_m: number | null
          id: string
          latitude: number | null
          longitude: number | null
          note: string | null
          otp_verified_at: string | null
          photos: Json | null
          receiver_name: string | null
          receiver_phone: string | null
          reporter_user_id: string
          signature_url: string | null
          task_id: string
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          delivered: boolean
          distance_to_dropoff_m?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          otp_verified_at?: string | null
          photos?: Json | null
          receiver_name?: string | null
          receiver_phone?: string | null
          reporter_user_id: string
          signature_url?: string | null
          task_id: string
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          delivered?: boolean
          distance_to_dropoff_m?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          otp_verified_at?: string | null
          photos?: Json | null
          receiver_name?: string | null
          receiver_phone?: string | null
          reporter_user_id?: string
          signature_url?: string | null
          task_id?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_reports_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_user_id: string
          created_at: string | null
          created_by: string
          description: string | null
          device_id: string | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_radius_m: number | null
          due_at: string | null
          id: string
          otp_expires_at: string | null
          otp_hash: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          qr_secret: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_user_id: string
          created_at?: string | null
          created_by: string
          description?: string | null
          device_id?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_radius_m?: number | null
          due_at?: string | null
          id?: string
          otp_expires_at?: string | null
          otp_hash?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          qr_secret?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_user_id?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          device_id?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_radius_m?: number | null
          due_at?: string | null
          id?: string
          otp_expires_at?: string | null
          otp_hash?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          qr_secret?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_track_sessions: {
        Row: {
          claimed_at: string | null
          created_at: string | null
          device_id: string | null
          expires_at: string
          guest_nickname: string | null
          id: string
          label: string | null
          last_seen_at: string | null
          owner_user_id: string
          status: string | null
          token: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string | null
          device_id?: string | null
          expires_at: string
          guest_nickname?: string | null
          id?: string
          label?: string | null
          last_seen_at?: string | null
          owner_user_id: string
          status?: string | null
          token: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string | null
          device_id?: string | null
          expires_at?: string
          guest_nickname?: string | null
          id?: string
          label?: string | null
          last_seen_at?: string | null
          owner_user_id?: string
          status?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_track_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          avg_speed_kmh: number | null
          created_at: string
          device_id: string
          distance_km: number | null
          duration_minutes: number | null
          end_latitude: number | null
          end_longitude: number | null
          end_time: string | null
          id: string
          max_speed_kmh: number | null
          start_latitude: number
          start_longitude: number
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          avg_speed_kmh?: number | null
          created_at?: string
          device_id: string
          distance_km?: number | null
          duration_minutes?: number | null
          end_latitude?: number | null
          end_longitude?: number | null
          end_time?: string | null
          id?: string
          max_speed_kmh?: number | null
          start_latitude: number
          start_longitude: number
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          avg_speed_kmh?: number | null
          created_at?: string
          device_id?: string
          distance_km?: number | null
          duration_minutes?: number | null
          end_latitude?: number | null
          end_longitude?: number | null
          end_time?: string | null
          id?: string
          max_speed_kmh?: number | null
          start_latitude?: number
          start_longitude?: number
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      check_driver_limit: { Args: { admin_id: string }; Returns: boolean }
      generate_connection_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "driver" | "user"
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
      app_role: ["admin", "moderator", "driver", "user"],
    },
  },
} as const
