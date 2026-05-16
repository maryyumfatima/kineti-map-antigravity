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
      ai_credits: {
        Row: {
          created_at: string | null
          credits_remaining: number | null
          credits_used: number | null
          id: string
          last_reset_date: string | null
          updated_at: string | null
          user_email: string
        }
        Insert: {
          created_at?: string | null
          credits_remaining?: number | null
          credits_used?: number | null
          id?: string
          last_reset_date?: string | null
          updated_at?: string | null
          user_email: string
        }
        Update: {
          created_at?: string | null
          credits_remaining?: number | null
          credits_used?: number | null
          id?: string
          last_reset_date?: string | null
          updated_at?: string | null
          user_email?: string
        }
        Relationships: []
      }
      ai_soap_drafts: {
        Row: {
          accepted: boolean | null
          booking_id: string | null
          clinic_id: string | null
          created_at: string | null
          draft_assessment: string | null
          draft_objective: string | null
          draft_plan: string | null
          draft_subjective: string | null
          id: string
          patient_id: string | null
        }
        Insert: {
          accepted?: boolean | null
          booking_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          draft_assessment?: string | null
          draft_objective?: string | null
          draft_plan?: string | null
          draft_subjective?: string | null
          id?: string
          patient_id?: string | null
        }
        Update: {
          accepted?: boolean | null
          booking_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          draft_assessment?: string | null
          draft_objective?: string | null
          draft_plan?: string | null
          draft_subjective?: string | null
          id?: string
          patient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_soap_drafts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_soap_drafts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_soap_drafts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_session_summary"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "ai_soap_drafts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string | null
          clinic_id: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          day_of_week: number | null
          end_time: string | null
          id: string
          is_active: boolean | null
          slot_duration_minutes: number | null
          start_time: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          slot_duration_minutes?: number | null
          start_time?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          slot_duration_minutes?: number | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          appointment_price: number | null
          appointment_time: string | null
          appointment_type: string | null
          clinic_id: string | null
          completed_by: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          pain_data: Json | null
          patient_id: string | null
          red_flags: Json | null
          session_completed_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_price?: number | null
          appointment_time?: string | null
          appointment_type?: string | null
          clinic_id?: string | null
          completed_by?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          pain_data?: Json | null
          patient_id?: string | null
          red_flags?: Json | null
          session_completed_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_price?: number | null
          appointment_time?: string | null
          appointment_type?: string | null
          clinic_id?: string | null
          completed_by?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          pain_data?: Json | null
          patient_id?: string | null
          red_flags?: Json | null
          session_completed_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "clinic_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_session_summary"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "bookings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_ledger: {
        Row: {
          amount: number | null
          booking_id: string | null
          clinic_id: string | null
          created_at: string | null
          currency: string | null
          id: string
          notes: string | null
          patient_id: string | null
          payment_status: string | null
          receipt_generated: boolean | null
          recorded_at: string | null
          recorded_by: string | null
        }
        Insert: {
          amount?: number | null
          booking_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          payment_status?: string | null
          receipt_generated?: boolean | null
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Update: {
          amount?: number | null
          booking_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          payment_status?: string | null
          receipt_generated?: boolean | null
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_ledger_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_ledger_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_ledger_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_session_summary"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "cash_ledger_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_ledger_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "clinic_users"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_users: {
        Row: {
          auth_user_id: string | null
          clinic_id: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          role: string | null
        }
        Insert: {
          auth_user_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: string | null
        }
        Update: {
          auth_user_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_users_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          ai_credits_limit: number | null
          ai_credits_used: number | null
          ai_reactivation_enabled: boolean | null
          ai_schedule_enabled: boolean | null
          ai_soap_enabled: boolean | null
          appointment_price: number | null
          bio: string | null
          booking_page_mode: string | null
          brand_color: string | null
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          default_slot_duration: number | null
          email: string | null
          id: string
          invite_link: string | null
          is_active: boolean | null
          journeys_reset_date: string | null
          location_name: string | null
          logo_url: string | null
          max_practitioners: number | null
          name: string | null
          onboarding_completed: boolean | null
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          paddle_subscription_status: string | null
          parent_clinic_id: string | null
          review_link: string | null
          secondary_color: string | null
          slug: string | null
          subscription_plan: string | null
          text_color: string | null
          timezone: string | null
          trial_ends_at: string | null
          updated_at: string | null
          website_url: string | null
          whatsapp_journeys_limit: number | null
          whatsapp_journeys_used: number | null
          whatsapp_number: string | null
        }
        Insert: {
          ai_credits_limit?: number | null
          ai_credits_used?: number | null
          ai_reactivation_enabled?: boolean | null
          ai_schedule_enabled?: boolean | null
          ai_soap_enabled?: boolean | null
          appointment_price?: number | null
          bio?: string | null
          booking_page_mode?: string | null
          brand_color?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          default_slot_duration?: number | null
          email?: string | null
          id?: string
          invite_link?: string | null
          is_active?: boolean | null
          journeys_reset_date?: string | null
          location_name?: string | null
          logo_url?: string | null
          max_practitioners?: number | null
          name?: string | null
          onboarding_completed?: boolean | null
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          paddle_subscription_status?: string | null
          parent_clinic_id?: string | null
          review_link?: string | null
          secondary_color?: string | null
          slug?: string | null
          subscription_plan?: string | null
          text_color?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          website_url?: string | null
          whatsapp_journeys_limit?: number | null
          whatsapp_journeys_used?: number | null
          whatsapp_number?: string | null
        }
        Update: {
          ai_credits_limit?: number | null
          ai_credits_used?: number | null
          ai_reactivation_enabled?: boolean | null
          ai_schedule_enabled?: boolean | null
          ai_soap_enabled?: boolean | null
          appointment_price?: number | null
          bio?: string | null
          booking_page_mode?: string | null
          brand_color?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          default_slot_duration?: number | null
          email?: string | null
          id?: string
          invite_link?: string | null
          is_active?: boolean | null
          journeys_reset_date?: string | null
          location_name?: string | null
          logo_url?: string | null
          max_practitioners?: number | null
          name?: string | null
          onboarding_completed?: boolean | null
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          paddle_subscription_status?: string | null
          parent_clinic_id?: string | null
          review_link?: string | null
          secondary_color?: string | null
          slug?: string | null
          subscription_plan?: string | null
          text_color?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          website_url?: string | null
          whatsapp_journeys_limit?: number | null
          whatsapp_journeys_used?: number | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinics_parent_clinic_id_fkey"
            columns: ["parent_clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          consent_type: string | null
          created_at: string | null
          granted: boolean | null
          id: string
          ip_address: string | null
          patient_id: string | null
          user_agent: string | null
        }
        Insert: {
          consent_type?: string | null
          created_at?: string | null
          granted?: boolean | null
          id?: string
          ip_address?: string | null
          patient_id?: string | null
          user_agent?: string | null
        }
        Update: {
          consent_type?: string | null
          created_at?: string | null
          granted?: boolean | null
          id?: string
          ip_address?: string | null
          patient_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_session_summary"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "consent_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          alert_triggered: boolean | null
          booking_id: string | null
          clinic_id: string | null
          comment: string | null
          created_at: string | null
          id: string
          patient_id: string | null
          review_link_sent: boolean | null
          score: number | null
        }
        Insert: {
          alert_triggered?: boolean | null
          booking_id?: string | null
          clinic_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          patient_id?: string | null
          review_link_sent?: boolean | null
          score?: number | null
        }
        Update: {
          alert_triggered?: boolean | null
          booking_id?: string | null
          clinic_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          patient_id?: string | null
          review_link_sent?: boolean | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_session_summary"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "feedback_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          code: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          phone_number: string | null
          used: boolean | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          phone_number?: string | null
          used?: boolean | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          phone_number?: string | null
          used?: boolean | null
        }
        Relationships: []
      }
      patient_activity_log: {
        Row: {
          action: string | null
          clinic_id: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          ip_address: string | null
          phone_number: string | null
          source: string | null
        }
        Insert: {
          action?: string | null
          clinic_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          ip_address?: string | null
          phone_number?: string | null
          source?: string | null
        }
        Update: {
          action?: string | null
          clinic_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          ip_address?: string | null
          phone_number?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_activity_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          ai_pain_summary: string | null
          archived_at: string | null
          archived_by: string | null
          clinic_id: string | null
          consent_date: string | null
          consent_toggle: boolean | null
          created_at: string | null
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string | null
          gdpr_consent: boolean | null
          guardian_name: string | null
          guardian_whatsapp: string | null
          id: string
          import_source: string | null
          is_deleted: boolean | null
          is_minor: boolean | null
          last_booked_at: string | null
          legal_hold: boolean | null
          marketing_opt_in: boolean | null
          otp_verified: boolean | null
          phone_number: string | null
          primary_complaint: string | null
          referral_source: string | null
          retention_expires_at: string | null
          status: string | null
          status_tag: string | null
        }
        Insert: {
          ai_pain_summary?: string | null
          archived_at?: string | null
          archived_by?: string | null
          clinic_id?: string | null
          consent_date?: string | null
          consent_toggle?: boolean | null
          created_at?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          gdpr_consent?: boolean | null
          guardian_name?: string | null
          guardian_whatsapp?: string | null
          id?: string
          import_source?: string | null
          is_deleted?: boolean | null
          is_minor?: boolean | null
          last_booked_at?: string | null
          legal_hold?: boolean | null
          marketing_opt_in?: boolean | null
          otp_verified?: boolean | null
          phone_number?: string | null
          primary_complaint?: string | null
          referral_source?: string | null
          retention_expires_at?: string | null
          status?: string | null
          status_tag?: string | null
        }
        Update: {
          ai_pain_summary?: string | null
          archived_at?: string | null
          archived_by?: string | null
          clinic_id?: string | null
          consent_date?: string | null
          consent_toggle?: boolean | null
          created_at?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          gdpr_consent?: boolean | null
          guardian_name?: string | null
          guardian_whatsapp?: string | null
          id?: string
          import_source?: string | null
          is_deleted?: boolean | null
          is_minor?: boolean | null
          last_booked_at?: string | null
          legal_hold?: boolean | null
          marketing_opt_in?: boolean | null
          otp_verified?: boolean | null
          phone_number?: string | null
          primary_complaint?: string | null
          referral_source?: string | null
          retention_expires_at?: string | null
          status?: string | null
          status_tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          booking_id: string | null
          clinic_id: string | null
          created_at: string | null
          id: string
          note_text: string | null
          patient_id: string | null
          type: string | null
        }
        Insert: {
          booking_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          note_text?: string | null
          patient_id?: string | null
          type?: string | null
        }
        Update: {
          booking_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          note_text?: string | null
          patient_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_session_summary"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "session_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      soap_notes: {
        Row: {
          assessment: string | null
          booking_id: string | null
          clinic_id: string | null
          created_at: string | null
          id: string
          is_ai_generated: boolean | null
          objective: string | null
          patient_id: string | null
          plan: string | null
          subjective: string | null
          updated_at: string | null
        }
        Insert: {
          assessment?: string | null
          booking_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          objective?: string | null
          patient_id?: string | null
          plan?: string | null
          subjective?: string | null
          updated_at?: string | null
        }
        Update: {
          assessment?: string | null
          booking_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          objective?: string | null
          patient_id?: string | null
          plan?: string | null
          subjective?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soap_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soap_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soap_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_session_summary"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "soap_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          id: string
          notified: boolean | null
          notified_at: string | null
          patient_id: string | null
          requested_date: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          notified?: boolean | null
          notified_at?: string | null
          patient_id?: string | null
          requested_date?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          notified?: boolean | null
          notified_at?: string | null
          patient_id?: string | null
          requested_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_session_summary"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "waitlist_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          booking_id: string | null
          clinic_id: string | null
          created_at: string | null
          delivered_at: string | null
          failure_reason: string | null
          id: string
          message_type: string | null
          patient_id: string | null
          read_at: string | null
          scheduled_for: string | null
          sent_at: string | null
          session_type_context: string | null
          status: string | null
          step_number: number | null
          twilio_message_sid: string | null
        }
        Insert: {
          booking_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          failure_reason?: string | null
          id?: string
          message_type?: string | null
          patient_id?: string | null
          read_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          session_type_context?: string | null
          status?: string | null
          step_number?: number | null
          twilio_message_sid?: string | null
        }
        Update: {
          booking_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          failure_reason?: string | null
          id?: string
          message_type?: string | null
          patient_id?: string | null
          read_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          session_type_context?: string | null
          status?: string | null
          step_number?: number | null
          twilio_message_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_session_summary"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      patient_session_summary: {
        Row: {
          clinic_id: string | null
          full_name: string | null
          last_session_date: string | null
          patient_id: string | null
          status: string | null
          total_sessions: number | null
          total_soap_notes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_retention_expiry: {
        Args: { patient_uuid: string }
        Returns: string
      }
      cleanup_temp_audio: { Args: never; Returns: undefined }
      get_my_clinic_id: { Args: never; Returns: string }
      is_clinic_admin: { Args: { check_clinic_id: string }; Returns: boolean }
      request_otp: { Args: { p_phone_number: string }; Returns: Json }
      reset_demo_data: { Args: never; Returns: undefined }
      upsert_patient: {
        Args: {
          p_clinic_id: string
          p_email: string
          p_full_name: string
          p_phone_number: string
        }
        Returns: undefined
      }
      user_clinic_ids: { Args: never; Returns: string[] }
      user_role_in_clinic: {
        Args: { target_clinic_id: string }
        Returns: string
      }
      verify_otp: {
        Args: { p_code: string; p_phone_number: string }
        Returns: Json
      }
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
