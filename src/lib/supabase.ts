import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://rhocpwxgmguylerbhnqn.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJob2Nwd3hnbWd1eWxlcmJobnFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4ODUxNDQsImV4cCI6MjA3NzQ2MTE0NH0.J1dLY-567QFm9dV23mWhiAiGa9ewUzM24-gjjRzjbwU"

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'regina-group-auth',
  },
})

// Database types
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name?: string
          role?: 'super_admin' | 'collaborator'
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string
          role?: 'super_admin' | 'collaborator'
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'super_admin' | 'collaborator'
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          domain_registration_date?: string
          domain_expiry_date?: string
          domain_cost?: number
          hosting_cost?: number
          start_date?: string
          end_date?: string
          status?: 'in_progress' | 'completed' | 'on_hold' | 'cancelled'
          reminder_emails?: string[]
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          name: string
          domain_registration_date?: string
          domain_expiry_date?: string
          domain_cost?: number
          hosting_cost?: number
          start_date?: string
          end_date?: string
          status?: 'in_progress' | 'completed' | 'on_hold' | 'cancelled'
          reminder_emails?: string[]
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          domain_registration_date?: string
          domain_expiry_date?: string
          domain_cost?: number
          hosting_cost?: number
          start_date?: string
          end_date?: string
          status?: 'in_progress' | 'completed' | 'on_hold' | 'cancelled'
          reminder_emails?: string[]
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      domains: {
        Row: {
          id: string
          project_id: string
          domain_name: string
          registrar?: string
          whois_data?: any
          last_checked?: string
          next_check?: string
          expiry_date?: string
          auto_renew?: boolean
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          project_id: string
          domain_name: string
          registrar?: string
          whois_data?: any
          last_checked?: string
          next_check?: string
          expiry_date?: string
          auto_renew?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          domain_name?: string
          registrar?: string
          whois_data?: any
          last_checked?: string
          next_check?: string
          expiry_date?: string
          auto_renew?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          project_id: string
          user_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          recipient_id?: string
          content: string
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          sender_id: string
          recipient_id?: string
          content: string
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          recipient_id?: string
          content?: string
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type?: 'domain_expiry' | 'project_update' | 'message' | 'system'
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type?: 'domain_expiry' | 'project_update' | 'message' | 'system'
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: 'domain_expiry' | 'project_update' | 'message' | 'system'
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      smtp_settings: {
        Row: {
          id: string
          host: string
          port: number
          username: string
          password: string
          use_tls?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          host: string
          port: number
          username: string
          password: string
          use_tls?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host?: string
          port?: number
          username?: string
          password?: string
          use_tls?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}