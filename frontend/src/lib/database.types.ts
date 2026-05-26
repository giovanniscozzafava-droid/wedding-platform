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
      beta_status: {
        Row: {
          free_until: string | null
          is_beta: boolean
          message_long: string | null
          message_short: string | null
          planned_currency: string | null
          planned_period: string | null
          planned_price: number | null
          role: string
          updated_at: string
        }
        Insert: {
          free_until?: string | null
          is_beta?: boolean
          message_long?: string | null
          message_short?: string | null
          planned_currency?: string | null
          planned_period?: string | null
          planned_price?: number | null
          role: string
          updated_at?: string
        }
        Update: {
          free_until?: string | null
          is_beta?: boolean
          message_long?: string | null
          message_short?: string | null
          planned_currency?: string | null
          planned_period?: string | null
          planned_price?: number | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      budget_categories: {
        Row: {
          color: string | null
          created_at: string
          entry_id: string
          id: string
          name: string
          ord: number
          planned_amount: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          entry_id: string
          id?: string
          name: string
          ord?: number
          planned_amount?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          entry_id?: string
          id?: string
          name?: string
          ord?: number
          planned_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_categories_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_entries: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          description: string
          entry_id: string
          id: string
          paid: boolean
          paid_at: string | null
          receipt_url: string | null
          supplier_id: string | null
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          description: string
          entry_id: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          receipt_url?: string | null
          supplier_id?: string | null
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          description?: string
          entry_id?: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          receipt_url?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_entries_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_entries_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_entries: {
        Row: {
          business_model: string
          client_email: string | null
          client_name: string | null
          created_at: string
          date_from: string
          date_to: string
          destination_country: string | null
          destination_language: string | null
          destination_location: string | null
          event_kind: string
          honeymoon_destination: string | null
          honeymoon_end: string | null
          honeymoon_notes: string | null
          honeymoon_start: string | null
          id: string
          is_destination: boolean
          notes: string | null
          owner_id: string
          quote_id: string | null
          status: Database["public"]["Enums"]["entry_status"]
          tables_naming_style: string | null
          theme: string | null
          title: string
          updated_at: string
          value_amount: number | null
          wedding_website_data: Json
          wedding_website_published: boolean
          wedding_website_slug: string | null
        }
        Insert: {
          business_model?: string
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          date_from: string
          date_to: string
          destination_country?: string | null
          destination_language?: string | null
          destination_location?: string | null
          event_kind?: string
          honeymoon_destination?: string | null
          honeymoon_end?: string | null
          honeymoon_notes?: string | null
          honeymoon_start?: string | null
          id?: string
          is_destination?: boolean
          notes?: string | null
          owner_id: string
          quote_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          tables_naming_style?: string | null
          theme?: string | null
          title: string
          updated_at?: string
          value_amount?: number | null
          wedding_website_data?: Json
          wedding_website_published?: boolean
          wedding_website_slug?: string | null
        }
        Update: {
          business_model?: string
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          date_from?: string
          date_to?: string
          destination_country?: string | null
          destination_language?: string | null
          destination_location?: string | null
          event_kind?: string
          honeymoon_destination?: string | null
          honeymoon_end?: string | null
          honeymoon_notes?: string | null
          honeymoon_start?: string | null
          id?: string
          is_destination?: boolean
          notes?: string | null
          owner_id?: string
          quote_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          tables_naming_style?: string | null
          theme?: string | null
          title?: string
          updated_at?: string
          value_amount?: number | null
          wedding_website_data?: Json
          wedding_website_published?: boolean
          wedding_website_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_entries_quote_fk"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_entry_participants: {
        Row: {
          confirmed: boolean
          created_at: string
          entry_id: string
          id: string
          role_in_entry: string | null
          user_id: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          entry_id: string
          id?: string
          role_in_entry?: string | null
          user_id: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          entry_id?: string
          id?: string
          role_in_entry?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_entry_participants_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_entry_participants_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_entry_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_export_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_export_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborations: {
        Row: {
          accepted_at: string | null
          capostipite_id: string
          created_at: string
          fornitore_id: string
          id: string
          initiated_by: string
          invite_token: string
          invited_at: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["collaboration_status"]
          supplier_markup_modifier_percent: number
          supplier_note: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          capostipite_id: string
          created_at?: string
          fornitore_id: string
          id?: string
          initiated_by?: string
          invite_token?: string
          invited_at?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["collaboration_status"]
          supplier_markup_modifier_percent?: number
          supplier_note?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          capostipite_id?: string
          created_at?: string
          fornitore_id?: string
          id?: string
          initiated_by?: string
          invite_token?: string
          invited_at?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["collaboration_status"]
          supplier_markup_modifier_percent?: number
          supplier_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborations_capostipite_id_fkey"
            columns: ["capostipite_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborations_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          access_token: string | null
          client_email: string | null
          client_fiscal_code: string | null
          client_name: string | null
          created_at: string
          direct_client_id: string | null
          entry_id: string | null
          event_date: string | null
          event_kind: string
          id: string
          owner_id: string
          pdf_url: string | null
          quote_id: string | null
          sections: Json
          signature_data: Json | null
          signed_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          client_email?: string | null
          client_fiscal_code?: string | null
          client_name?: string | null
          created_at?: string
          direct_client_id?: string | null
          entry_id?: string | null
          event_date?: string | null
          event_kind?: string
          id?: string
          owner_id: string
          pdf_url?: string | null
          quote_id?: string | null
          sections?: Json
          signature_data?: Json | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          client_email?: string | null
          client_fiscal_code?: string | null
          client_name?: string | null
          created_at?: string
          direct_client_id?: string | null
          entry_id?: string | null
          event_date?: string | null
          event_kind?: string
          id?: string
          owner_id?: string
          pdf_url?: string | null
          quote_id?: string | null
          sections?: Json
          signature_data?: Json | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_direct_client_id_fkey"
            columns: ["direct_client_id"]
            isOneToOne: false
            referencedRelation: "supplier_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_direct_client_id_fkey"
            columns: ["direct_client_id"]
            isOneToOne: false
            referencedRelation: "supplier_clients_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts_legacy_audit: {
        Row: {
          id: string | null
          original_signature_data: Json | null
          original_signed_at: string | null
          patched_at: string | null
          patched_signature_data: Json | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          original_signature_data?: Json | null
          original_signed_at?: string | null
          patched_at?: string | null
          patched_signature_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          original_signature_data?: Json | null
          original_signed_at?: string | null
          patched_at?: string | null
          patched_signature_data?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      couple_change_requests: {
        Row: {
          action: Database["public"]["Enums"]["change_request_action"]
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["change_request_entity"]
          id: string
          payload: Json
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["change_request_status"]
          title: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          action?: Database["public"]["Enums"]["change_request_action"]
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: Database["public"]["Enums"]["change_request_entity"]
          id?: string
          payload?: Json
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          title: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["change_request_action"]
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["change_request_entity"]
          id?: string
          payload?: Json
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          title?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_change_requests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_change_requests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_preferences: {
        Row: {
          bride_name: string | null
          budget_max: number | null
          budget_min: number | null
          budget_priority: string | null
          couple_name: string | null
          created_at: string
          entry_id: string
          groom_name: string | null
          guests_estimate: number | null
          id: string
          location_kind: string | null
          must_haves: string[] | null
          no_thanks: string[] | null
          preferred_palette: string[] | null
          preferred_season: string | null
          styles: Database["public"]["Enums"]["wedding_style"][] | null
          updated_at: string
          vision_note: string | null
        }
        Insert: {
          bride_name?: string | null
          budget_max?: number | null
          budget_min?: number | null
          budget_priority?: string | null
          couple_name?: string | null
          created_at?: string
          entry_id: string
          groom_name?: string | null
          guests_estimate?: number | null
          id?: string
          location_kind?: string | null
          must_haves?: string[] | null
          no_thanks?: string[] | null
          preferred_palette?: string[] | null
          preferred_season?: string | null
          styles?: Database["public"]["Enums"]["wedding_style"][] | null
          updated_at?: string
          vision_note?: string | null
        }
        Update: {
          bride_name?: string | null
          budget_max?: number | null
          budget_min?: number | null
          budget_priority?: string | null
          couple_name?: string | null
          created_at?: string
          entry_id?: string
          groom_name?: string | null
          guests_estimate?: number | null
          id?: string
          location_kind?: string | null
          must_haves?: string[] | null
          no_thanks?: string[] | null
          preferred_palette?: string[] | null
          preferred_season?: string | null
          styles?: Database["public"]["Enums"]["wedding_style"][] | null
          updated_at?: string
          vision_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couple_preferences_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_preferences_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_accommodations: {
        Row: {
          address: string | null
          check_in: string | null
          check_out: string | null
          checkin_date: string | null
          checkout_date: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          currency: string | null
          distance_km: number | null
          entry_id: string
          id: string
          kind: Database["public"]["Enums"]["accommodation_kind"]
          name: string
          notes: string | null
          promo_code: string | null
          rate_per_night: number | null
          rooms_blocked: number | null
          rooms_used: number | null
          total_beds: number | null
          total_rooms: number | null
          updated_at: string
          url: string | null
        }
        Insert: {
          address?: string | null
          check_in?: string | null
          check_out?: string | null
          checkin_date?: string | null
          checkout_date?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string | null
          distance_km?: number | null
          entry_id: string
          id?: string
          kind?: Database["public"]["Enums"]["accommodation_kind"]
          name: string
          notes?: string | null
          promo_code?: string | null
          rate_per_night?: number | null
          rooms_blocked?: number | null
          rooms_used?: number | null
          total_beds?: number | null
          total_rooms?: number | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          address?: string | null
          check_in?: string | null
          check_out?: string | null
          checkin_date?: string | null
          checkout_date?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string | null
          distance_km?: number | null
          entry_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["accommodation_kind"]
          name?: string
          notes?: string | null
          promo_code?: string | null
          rate_per_night?: number | null
          rooms_blocked?: number | null
          rooms_used?: number | null
          total_beds?: number | null
          total_rooms?: number | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_accommodations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_accommodations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_documents: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          kind: string
          mime: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          kind?: string
          mime?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          kind?: string
          mime?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_documents_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_gadgets: {
        Row: {
          cover_image_url: string | null
          created_at: string
          currency: string | null
          description: string | null
          due_at: string | null
          entry_id: string
          id: string
          kind: Database["public"]["Enums"]["gadget_kind"]
          name: string
          notes: string | null
          quantity: number
          quantity_basis: Database["public"]["Enums"]["quantity_basis"]
          status: string
          supplier_external: string | null
          supplier_id: string | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          due_at?: string | null
          entry_id: string
          id?: string
          kind?: Database["public"]["Enums"]["gadget_kind"]
          name: string
          notes?: string | null
          quantity?: number
          quantity_basis?: Database["public"]["Enums"]["quantity_basis"]
          status?: string
          supplier_external?: string | null
          supplier_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          due_at?: string | null
          entry_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["gadget_kind"]
          name?: string
          notes?: string | null
          quantity?: number
          quantity_basis?: Database["public"]["Enums"]["quantity_basis"]
          status?: string
          supplier_external?: string | null
          supplier_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_gadgets_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_gadgets_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_gadgets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_guest_accommodation: {
        Row: {
          accommodation_id: string
          check_in: string | null
          check_out: string | null
          created_at: string
          entry_id: string
          guest_id: string
          id: string
          notes: string | null
          room_label: string | null
        }
        Insert: {
          accommodation_id: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          entry_id: string
          guest_id: string
          id?: string
          notes?: string | null
          room_label?: string | null
        }
        Update: {
          accommodation_id?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          entry_id?: string
          guest_id?: string
          id?: string
          notes?: string | null
          room_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_guest_accommodation_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "event_accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guest_accommodation_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guest_accommodation_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guest_accommodation_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "event_guests"
            referencedColumns: ["id"]
          },
        ]
      }
      event_guest_transport: {
        Row: {
          created_at: string
          entry_id: string
          guest_id: string
          id: string
          notes: string | null
          transport_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          guest_id: string
          id?: string
          notes?: string | null
          transport_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          guest_id?: string
          id?: string
          notes?: string | null
          transport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_guest_transport_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guest_transport_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guest_transport_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "event_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guest_transport_transport_id_fkey"
            columns: ["transport_id"]
            isOneToOne: false
            referencedRelation: "event_transport"
            referencedColumns: ["id"]
          },
        ]
      }
      event_guests: {
        Row: {
          accommodation_id: string | null
          arrival_at: string | null
          created_at: string
          departure_at: string | null
          diet: string | null
          email: string | null
          entry_id: string
          full_name: string
          group_label: string | null
          id: string
          needs_transport: boolean
          nights_count: number | null
          notes: string | null
          party_size: number
          phone: string | null
          room_share_with: string | null
          rsvp: Database["public"]["Enums"]["rsvp_status"]
          seat_no: number | null
          side: string | null
          table_id: string | null
          travel_origin: string | null
          updated_at: string
        }
        Insert: {
          accommodation_id?: string | null
          arrival_at?: string | null
          created_at?: string
          departure_at?: string | null
          diet?: string | null
          email?: string | null
          entry_id: string
          full_name: string
          group_label?: string | null
          id?: string
          needs_transport?: boolean
          nights_count?: number | null
          notes?: string | null
          party_size?: number
          phone?: string | null
          room_share_with?: string | null
          rsvp?: Database["public"]["Enums"]["rsvp_status"]
          seat_no?: number | null
          side?: string | null
          table_id?: string | null
          travel_origin?: string | null
          updated_at?: string
        }
        Update: {
          accommodation_id?: string | null
          arrival_at?: string | null
          created_at?: string
          departure_at?: string | null
          diet?: string | null
          email?: string | null
          entry_id?: string
          full_name?: string
          group_label?: string | null
          id?: string
          needs_transport?: boolean
          nights_count?: number | null
          notes?: string | null
          party_size?: number
          phone?: string | null
          room_share_with?: string | null
          rsvp?: Database["public"]["Enums"]["rsvp_status"]
          seat_no?: number | null
          side?: string | null
          table_id?: string | null
          travel_origin?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_guests_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "event_accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guests_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guests_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guests_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "event_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      event_menu: {
        Row: {
          allergens: string[]
          created_at: string
          description: string | null
          dietary_tags: string[]
          entry_id: string
          id: string
          is_optional: boolean
          notes: string | null
          ord: number
          price_per_guest: number | null
          section: Database["public"]["Enums"]["menu_section_kind"]
          supplier_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          allergens?: string[]
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          entry_id: string
          id?: string
          is_optional?: boolean
          notes?: string | null
          ord?: number
          price_per_guest?: number | null
          section: Database["public"]["Enums"]["menu_section_kind"]
          supplier_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          allergens?: string[]
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          entry_id?: string
          id?: string
          is_optional?: boolean
          notes?: string | null
          ord?: number
          price_per_guest?: number | null
          section?: Database["public"]["Enums"]["menu_section_kind"]
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_menu_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_menu_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_menu_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_playlist: {
        Row: {
          artist: string | null
          created_at: string
          done: boolean
          entry_id: string
          id: string
          moment: string
          notes: string | null
          ord: number
          song_title: string
        }
        Insert: {
          artist?: string | null
          created_at?: string
          done?: boolean
          entry_id: string
          id?: string
          moment: string
          notes?: string | null
          ord?: number
          song_title: string
        }
        Update: {
          artist?: string | null
          created_at?: string
          done?: boolean
          entry_id?: string
          id?: string
          moment?: string
          notes?: string | null
          ord?: number
          song_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_playlist_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_playlist_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_subevents: {
        Row: {
          attending_count: number | null
          budget: number | null
          capacity: number | null
          contact_phone: string | null
          cover_image_url: string | null
          created_at: string
          date_at: string | null
          description: string | null
          duration_min: number | null
          entry_id: string
          id: string
          kind: Database["public"]["Enums"]["subevent_kind"]
          location: string | null
          notes: string | null
          organizer: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attending_count?: number | null
          budget?: number | null
          capacity?: number | null
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          date_at?: string | null
          description?: string | null
          duration_min?: number | null
          entry_id: string
          id?: string
          kind?: Database["public"]["Enums"]["subevent_kind"]
          location?: string | null
          notes?: string | null
          organizer?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attending_count?: number | null
          budget?: number | null
          capacity?: number | null
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          date_at?: string | null
          description?: string | null
          duration_min?: number | null
          entry_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["subevent_kind"]
          location?: string | null
          notes?: string | null
          organizer?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_subevents_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_subevents_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tables: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          label: string | null
          pos_x: number | null
          pos_y: number | null
          seats: number
          shape: string
          table_no: number
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          label?: string | null
          pos_x?: number | null
          pos_y?: number | null
          seats?: number
          shape?: string
          table_no: number
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          label?: string | null
          pos_x?: number | null
          pos_y?: number | null
          seats?: number
          shape?: string
          table_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_tables_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tables_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_timeline: {
        Row: {
          created_at: string
          description: string | null
          duration_min: number | null
          entry_id: string
          id: string
          is_critical: boolean
          location: string | null
          ord: number
          start_time: string | null
          supplier_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_min?: number | null
          entry_id: string
          id?: string
          is_critical?: boolean
          location?: string | null
          ord?: number
          start_time?: string | null
          supplier_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_min?: number | null
          entry_id?: string
          id?: string
          is_critical?: boolean
          location?: string | null
          ord?: number
          start_time?: string | null
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_timeline_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_timeline_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_timeline_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_transport: {
        Row: {
          arrive_at: string | null
          arrive_to: string | null
          capacity: number | null
          contact_email: string | null
          contact_phone: string | null
          cost: number | null
          created_at: string
          currency: string | null
          depart_at: string | null
          depart_from: string | null
          driver_name: string | null
          entry_id: string
          flight_number: string | null
          id: string
          kind: Database["public"]["Enums"]["transport_kind"]
          label: string
          notes: string | null
          passengers_count: number | null
          provider: string | null
          route_notes: string | null
          updated_at: string
        }
        Insert: {
          arrive_at?: string | null
          arrive_to?: string | null
          capacity?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          depart_at?: string | null
          depart_from?: string | null
          driver_name?: string | null
          entry_id: string
          flight_number?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["transport_kind"]
          label: string
          notes?: string | null
          passengers_count?: number | null
          provider?: string | null
          route_notes?: string | null
          updated_at?: string
        }
        Update: {
          arrive_at?: string | null
          arrive_to?: string | null
          capacity?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          depart_at?: string | null
          depart_from?: string | null
          driver_name?: string | null
          entry_id?: string
          flight_number?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["transport_kind"]
          label?: string
          notes?: string | null
          passengers_count?: number | null
          provider?: string | null
          route_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_transport_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_transport_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_transport_assignments: {
        Row: {
          guest_id: string
          id: string
          notes: string | null
          seat: string | null
          transport_id: string
        }
        Insert: {
          guest_id: string
          id?: string
          notes?: string | null
          seat?: string | null
          transport_id: string
        }
        Update: {
          guest_id?: string
          id?: string
          notes?: string | null
          seat?: string | null
          transport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_transport_assignments_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "event_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_transport_assignments_transport_id_fkey"
            columns: ["transport_id"]
            isOneToOne: false
            referencedRelation: "event_transport"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_applications: {
        Row: {
          amount: number
          applicant_id: string
          created_at: string
          id: string
          months: number
          notes: string | null
          offer_id: string | null
          quote_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          applicant_id: string
          created_at?: string
          id?: string
          months: number
          notes?: string | null
          offer_id?: string | null
          quote_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          applicant_id?: string
          created_at?: string
          id?: string
          months?: number
          notes?: string | null
          offer_id?: string | null
          quote_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_applications_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "finance_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_applications_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_offers: {
        Row: {
          apr_percent: number | null
          contract_terms: string | null
          created_at: string
          description: string | null
          exclusive_until: string | null
          id: string
          is_active: boolean
          max_amount: number | null
          max_months: number | null
          partner_logo_url: string | null
          partner_name: string
          updated_at: string
        }
        Insert: {
          apr_percent?: number | null
          contract_terms?: string | null
          created_at?: string
          description?: string | null
          exclusive_until?: string | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          max_months?: number | null
          partner_logo_url?: string | null
          partner_name: string
          updated_at?: string
        }
        Update: {
          apr_percent?: number | null
          contract_terms?: string | null
          created_at?: string
          description?: string | null
          exclusive_until?: string | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          max_months?: number | null
          partner_logo_url?: string | null
          partner_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurance_offers: {
        Row: {
          base_price: number | null
          contract_terms: string | null
          coverage_type: string | null
          created_at: string
          description: string | null
          exclusive_until: string | null
          id: string
          is_active: boolean
          partner_logo_url: string | null
          partner_name: string
          product_name: string
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          contract_terms?: string | null
          coverage_type?: string | null
          created_at?: string
          description?: string | null
          exclusive_until?: string | null
          id?: string
          is_active?: boolean
          partner_logo_url?: string | null
          partner_name: string
          product_name: string
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          contract_terms?: string | null
          coverage_type?: string | null
          created_at?: string
          description?: string | null
          exclusive_until?: string | null
          id?: string
          is_active?: boolean
          partner_logo_url?: string | null
          partner_name?: string
          product_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurance_policies: {
        Row: {
          created_at: string
          end_date: string | null
          entry_id: string
          id: string
          notes: string | null
          offer_id: string | null
          policy_number: string | null
          premium: number | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          entry_id: string
          id?: string
          notes?: string | null
          offer_id?: string | null
          policy_number?: string | null
          premium?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          entry_id?: string
          id?: string
          notes?: string | null
          offer_id?: string | null
          policy_number?: string | null
          premium?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_policies_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_policies_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_policies_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "insurance_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      market_prices: {
        Row: {
          id: string
          notes: string | null
          price_median: number
          price_p25: number
          price_p75: number
          region: string | null
          sample_size: number
          service_kind: string
          subrole: string
          unit: Database["public"]["Enums"]["service_unit"]
          updated_at: string
        }
        Insert: {
          id?: string
          notes?: string | null
          price_median: number
          price_p25: number
          price_p75: number
          region?: string | null
          sample_size?: number
          service_kind: string
          subrole: string
          unit?: Database["public"]["Enums"]["service_unit"]
          updated_at?: string
        }
        Update: {
          id?: string
          notes?: string | null
          price_median?: number
          price_p25?: number
          price_p75?: number
          region?: string | null
          sample_size?: number
          service_kind?: string
          subrole?: string
          unit?: Database["public"]["Enums"]["service_unit"]
          updated_at?: string
        }
        Relationships: []
      }
      menu_presets: {
        Row: {
          allergens: string[]
          created_at: string
          description: string | null
          dietary_tags: string[]
          id: string
          is_active: boolean
          notes: string | null
          region: string | null
          section: Database["public"]["Enums"]["menu_section_kind"]
          title: string
          typical_price_per_guest: number | null
        }
        Insert: {
          allergens?: string[]
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          id?: string
          is_active?: boolean
          notes?: string | null
          region?: string | null
          section: Database["public"]["Enums"]["menu_section_kind"]
          title: string
          typical_price_per_guest?: number | null
        }
        Update: {
          allergens?: string[]
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          id?: string
          is_active?: boolean
          notes?: string | null
          region?: string | null
          section?: Database["public"]["Enums"]["menu_section_kind"]
          title?: string
          typical_price_per_guest?: number | null
        }
        Relationships: []
      }
      mood_images: {
        Row: {
          caption: string | null
          created_at: string
          entry_id: string
          id: string
          ord: number
          source: string | null
          source_title: string | null
          source_url: string | null
          tag: string | null
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          entry_id: string
          id?: string
          ord?: number
          source?: string | null
          source_title?: string | null
          source_url?: string | null
          tag?: string | null
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          entry_id?: string
          id?: string
          ord?: number
          source?: string | null
          source_title?: string | null
          source_url?: string | null
          tag?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_images_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mood_images_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          attempts: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          scheduled_for: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          payload: Json
          scheduled_for?: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          scheduled_for?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_versions: {
        Row: {
          created_at: string
          id: string
          price: number
          service_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          price: number
          service_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          service_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_versions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          bio: string | null
          brand_logo_url: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
          business_name: string | null
          city: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          default_markup_percent: number
          deletion_requested_at: string | null
          facebook: string | null
          fiscal_code: string | null
          full_name: string | null
          id: string
          instagram: string | null
          marketing_consent_at: string | null
          notification_preferences: Json
          offers_full_dining: boolean
          onboarding_complete: boolean
          phone: string | null
          privacy_consent_at: string | null
          profile_visibility: Database["public"]["Enums"]["profile_visibility"]
          role: Database["public"]["Enums"]["user_role"]
          service_radius_km: number | null
          subrole: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          tiktok: string | null
          tutorial_state: Json
          updated_at: string
          vat_number: string | null
          website: string | null
          work_style: string | null
          years_active: number | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          bio?: string | null
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          business_name?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          default_markup_percent?: number
          deletion_requested_at?: string | null
          facebook?: string | null
          fiscal_code?: string | null
          full_name?: string | null
          id: string
          instagram?: string | null
          marketing_consent_at?: string | null
          notification_preferences?: Json
          offers_full_dining?: boolean
          onboarding_complete?: boolean
          phone?: string | null
          privacy_consent_at?: string | null
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          role: Database["public"]["Enums"]["user_role"]
          service_radius_km?: number | null
          subrole?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          tiktok?: string | null
          tutorial_state?: Json
          updated_at?: string
          vat_number?: string | null
          website?: string | null
          work_style?: string | null
          years_active?: number | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          bio?: string | null
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          business_name?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          default_markup_percent?: number
          deletion_requested_at?: string | null
          facebook?: string | null
          fiscal_code?: string | null
          full_name?: string | null
          id?: string
          instagram?: string | null
          marketing_consent_at?: string | null
          notification_preferences?: Json
          offers_full_dining?: boolean
          onboarding_complete?: boolean
          phone?: string | null
          privacy_consent_at?: string | null
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          role?: Database["public"]["Enums"]["user_role"]
          service_radius_km?: number | null
          subrole?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          tiktok?: string | null
          tutorial_state?: Json
          updated_at?: string
          vat_number?: string | null
          website?: string | null
          work_style?: string | null
          years_active?: number | null
          zip?: string | null
        }
        Relationships: []
      }
      quote_acceptances: {
        Row: {
          acceptance_pdf_url: string | null
          accepted_at: string
          access_token: string
          consent_privacy: boolean
          consent_terms: boolean
          created_at: string
          doc_issued_by: string | null
          doc_number: string
          doc_type: string
          id: string
          ip_address: string | null
          quote_id: string
          quote_pdf_hash: string | null
          quote_revision: number
          signature_url: string
          signer_email: string
          signer_name: string
          signer_phone: string | null
          user_agent: string | null
        }
        Insert: {
          acceptance_pdf_url?: string | null
          accepted_at?: string
          access_token: string
          consent_privacy?: boolean
          consent_terms?: boolean
          created_at?: string
          doc_issued_by?: string | null
          doc_number: string
          doc_type: string
          id?: string
          ip_address?: string | null
          quote_id: string
          quote_pdf_hash?: string | null
          quote_revision: number
          signature_url: string
          signer_email: string
          signer_name: string
          signer_phone?: string | null
          user_agent?: string | null
        }
        Update: {
          acceptance_pdf_url?: string | null
          accepted_at?: string
          access_token?: string
          consent_privacy?: boolean
          consent_terms?: boolean
          created_at?: string
          doc_issued_by?: string | null
          doc_number?: string
          doc_type?: string
          id?: string
          ip_address?: string | null
          quote_id?: string
          quote_pdf_hash?: string | null
          quote_revision?: number
          signature_url?: string
          signer_email?: string
          signer_name?: string
          signer_phone?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_acceptances_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_acceptances_audit: {
        Row: {
          acceptance_pdf_url: string | null
          accepted_at: string
          access_token: string
          audit_at: string
          audit_reason: string | null
          consent_privacy: boolean
          consent_terms: boolean
          created_at: string
          doc_issued_by: string | null
          doc_number: string
          doc_type: string
          id: string
          ip_address: string | null
          quote_id: string
          quote_pdf_hash: string | null
          quote_revision: number
          signature_url: string
          signer_email: string
          signer_name: string
          signer_phone: string | null
          user_agent: string | null
        }
        Insert: {
          acceptance_pdf_url?: string | null
          accepted_at?: string
          access_token: string
          audit_at?: string
          audit_reason?: string | null
          consent_privacy?: boolean
          consent_terms?: boolean
          created_at?: string
          doc_issued_by?: string | null
          doc_number: string
          doc_type: string
          id?: string
          ip_address?: string | null
          quote_id: string
          quote_pdf_hash?: string | null
          quote_revision: number
          signature_url: string
          signer_email: string
          signer_name: string
          signer_phone?: string | null
          user_agent?: string | null
        }
        Update: {
          acceptance_pdf_url?: string | null
          accepted_at?: string
          access_token?: string
          audit_at?: string
          audit_reason?: string | null
          consent_privacy?: boolean
          consent_terms?: boolean
          created_at?: string
          doc_issued_by?: string | null
          doc_number?: string
          doc_type?: string
          id?: string
          ip_address?: string | null
          quote_id?: string
          quote_pdf_hash?: string | null
          quote_revision?: number
          signature_url?: string
          signer_email?: string
          signer_name?: string
          signer_phone?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          alternative_group: string | null
          client_selected_at: string | null
          created_at: string
          description_snapshot: string | null
          id: string
          is_optional: boolean
          item_markup_percent: number | null
          line_client: number
          line_cost: number
          modifiers_applied: Json
          name_snapshot: string
          paid_amount: number
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          quantity: number
          quantity_basis: Database["public"]["Enums"]["quantity_basis"]
          quote_id: string
          selected_by_client: boolean | null
          service_id: string | null
          snapshot_price: number
          sort_order: number
          supplier_id: string | null
          unit_snapshot: Database["public"]["Enums"]["service_unit"]
          updated_at: string
        }
        Insert: {
          alternative_group?: string | null
          client_selected_at?: string | null
          created_at?: string
          description_snapshot?: string | null
          id?: string
          is_optional?: boolean
          item_markup_percent?: number | null
          line_client?: number
          line_cost?: number
          modifiers_applied?: Json
          name_snapshot: string
          paid_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          quantity?: number
          quantity_basis?: Database["public"]["Enums"]["quantity_basis"]
          quote_id: string
          selected_by_client?: boolean | null
          service_id?: string | null
          snapshot_price: number
          sort_order?: number
          supplier_id?: string | null
          unit_snapshot?: Database["public"]["Enums"]["service_unit"]
          updated_at?: string
        }
        Update: {
          alternative_group?: string | null
          client_selected_at?: string | null
          created_at?: string
          description_snapshot?: string | null
          id?: string
          is_optional?: boolean
          item_markup_percent?: number | null
          line_client?: number
          line_cost?: number
          modifiers_applied?: Json
          name_snapshot?: string
          paid_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          quantity?: number
          quantity_basis?: Database["public"]["Enums"]["quantity_basis"]
          quote_id?: string
          selected_by_client?: boolean | null
          service_id?: string | null
          snapshot_price?: number
          sort_order?: number
          supplier_id?: string | null
          unit_snapshot?: Database["public"]["Enums"]["service_unit"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_questionnaire_answers: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          event_kind: string
          id: string
          quote_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          event_kind?: string
          id?: string
          quote_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          event_kind?: string
          id?: string
          quote_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_questionnaire_answers_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_supplier_markups: {
        Row: {
          created_at: string
          id: string
          markup_percent: number
          quote_id: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          markup_percent: number
          quote_id: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          markup_percent?: number
          quote_id?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_supplier_markups_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_supplier_markups_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_views: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          payload: Json
          quote_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          payload?: Json
          quote_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          payload?: Json
          quote_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_views_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          access_token: string | null
          client_email: string | null
          client_name: string | null
          client_response_log: Json
          created_at: string
          default_markup_percent: number
          direct_client_id: string | null
          event_date: string | null
          event_kind: string
          event_location: string | null
          guest_count: number | null
          id: string
          margin_amount: number
          margin_percent: number
          owner_id: string
          pdf_url: string | null
          pdf_variant: Database["public"]["Enums"]["pdf_variant"]
          rejected_at: string | null
          rejection_reason: string | null
          revision: number
          sent_at: string | null
          sent_email_log: Json
          status: Database["public"]["Enums"]["quote_status"]
          table_count: number | null
          title: string
          total_client: number
          total_cost: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          access_token?: string | null
          client_email?: string | null
          client_name?: string | null
          client_response_log?: Json
          created_at?: string
          default_markup_percent?: number
          direct_client_id?: string | null
          event_date?: string | null
          event_kind?: string
          event_location?: string | null
          guest_count?: number | null
          id?: string
          margin_amount?: number
          margin_percent?: number
          owner_id: string
          pdf_url?: string | null
          pdf_variant?: Database["public"]["Enums"]["pdf_variant"]
          rejected_at?: string | null
          rejection_reason?: string | null
          revision?: number
          sent_at?: string | null
          sent_email_log?: Json
          status?: Database["public"]["Enums"]["quote_status"]
          table_count?: number | null
          title: string
          total_client?: number
          total_cost?: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          access_token?: string | null
          client_email?: string | null
          client_name?: string | null
          client_response_log?: Json
          created_at?: string
          default_markup_percent?: number
          direct_client_id?: string | null
          event_date?: string | null
          event_kind?: string
          event_location?: string | null
          guest_count?: number | null
          id?: string
          margin_amount?: number
          margin_percent?: number
          owner_id?: string
          pdf_url?: string | null
          pdf_variant?: Database["public"]["Enums"]["pdf_variant"]
          rejected_at?: string | null
          rejection_reason?: string | null
          revision?: number
          sent_at?: string | null
          sent_email_log?: Json
          status?: Database["public"]["Enums"]["quote_status"]
          table_count?: number | null
          title?: string
          total_client?: number
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_direct_client_id_fkey"
            columns: ["direct_client_id"]
            isOneToOne: false
            referencedRelation: "supplier_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_direct_client_id_fkey"
            columns: ["direct_client_id"]
            isOneToOne: false
            referencedRelation: "supplier_clients_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_standard: boolean
          name: string
          slug: string
          subrole: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_standard?: boolean
          name: string
          slug: string
          subrole?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_standard?: boolean
          name?: string
          slug?: string
          subrole?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_components: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          ord: number
          quantity: number
          service_id: string
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          ord?: number
          quantity?: number
          service_id: string
          unit?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          ord?: number
          quantity?: number
          service_id?: string
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_components_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_modifiers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          modifier_type: Database["public"]["Enums"]["modifier_type"]
          name: string
          service_id: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          modifier_type: Database["public"]["Enums"]["modifier_type"]
          name: string
          service_id: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          modifier_type?: Database["public"]["Enums"]["modifier_type"]
          name?: string
          service_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_modifiers_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_photos: {
        Row: {
          created_at: string
          id: string
          original_url: string
          service_id: string
          sort_order: number
          thumbnail_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_url: string
          service_id: string
          sort_order?: number
          thumbnail_url: string
        }
        Update: {
          created_at?: string
          id?: string
          original_url?: string
          service_id?: string
          sort_order?: number
          thumbnail_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_photos_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_presets: {
        Row: {
          category_id: string | null
          created_at: string
          default_price: number | null
          default_unit: Database["public"]["Enums"]["service_unit"] | null
          description: string | null
          fornitore_id: string
          id: string
          is_template: boolean
          items: Json
          name: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          default_price?: number | null
          default_unit?: Database["public"]["Enums"]["service_unit"] | null
          description?: string | null
          fornitore_id: string
          id?: string
          is_template?: boolean
          items?: Json
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          default_price?: number | null
          default_unit?: Database["public"]["Enums"]["service_unit"] | null
          description?: string | null
          fornitore_id?: string
          id?: string
          is_template?: boolean
          items?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_presets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_presets_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_price: number
          category_id: string
          created_at: string
          description: string | null
          fornitore_id: string
          id: string
          is_active: boolean
          name: string
          unit: Database["public"]["Enums"]["service_unit"]
          updated_at: string
        }
        Insert: {
          base_price: number
          category_id: string
          created_at?: string
          description?: string | null
          fornitore_id: string
          id?: string
          is_active?: boolean
          name: string
          unit?: Database["public"]["Enums"]["service_unit"]
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: string
          created_at?: string
          description?: string | null
          fornitore_id?: string
          id?: string
          is_active?: boolean
          name?: string
          unit?: Database["public"]["Enums"]["service_unit"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_availability: {
        Row: {
          created_at: string
          date: string
          fornitore_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["supplier_avail_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          fornitore_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["supplier_avail_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          fornitore_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["supplier_avail_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_availability_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_capostipite_pricing: {
        Row: {
          capostipite_id: string
          created_at: string
          id: string
          notes: string | null
          override_price: number
          service_id: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          capostipite_id: string
          created_at?: string
          id?: string
          notes?: string | null
          override_price: number
          service_id: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          capostipite_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          override_price?: number
          service_id?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_capostipite_pricing_capostipite_id_fkey"
            columns: ["capostipite_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_capostipite_pricing_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_capostipite_pricing_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_clients: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          created_at: string
          email: string | null
          event_date: string | null
          event_kind: string | null
          fiscal_code: string | null
          full_name: string
          guest_estimate: number | null
          id: string
          location_text: string | null
          notes: string | null
          partner_name: string | null
          phone: string | null
          source: string | null
          status: string
          supplier_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          email?: string | null
          event_date?: string | null
          event_kind?: string | null
          fiscal_code?: string | null
          full_name: string
          guest_estimate?: number | null
          id?: string
          location_text?: string | null
          notes?: string | null
          partner_name?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          supplier_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          email?: string | null
          event_date?: string | null
          event_kind?: string | null
          fiscal_code?: string | null
          full_name?: string
          guest_estimate?: number | null
          id?: string
          location_text?: string | null
          notes?: string | null
          partner_name?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          supplier_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_clients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invites: {
        Row: {
          accepted_at: string | null
          capostipite_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_at: string
          message: string | null
          status: string
          subrole_hint: string | null
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          capostipite_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_at?: string
          message?: string | null
          status?: string
          subrole_hint?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          capostipite_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_at?: string
          message?: string | null
          status?: string
          subrole_hint?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invites_capostipite_id_fkey"
            columns: ["capostipite_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_couple_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          entry_id: string
          full_name: string | null
          id: string
          invite_token: string
          invited_at: string
          role: Database["public"]["Enums"]["couple_role"]
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          entry_id: string
          full_name?: string | null
          id?: string
          invite_token?: string
          invited_at?: string
          role?: Database["public"]["Enums"]["couple_role"]
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          entry_id?: string
          full_name?: string | null
          id?: string
          invite_token?: string
          invited_at?: string
          role?: Database["public"]["Enums"]["couple_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wedding_couple_members_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_couple_members_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_couple_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_tasks: {
        Row: {
          created_at: string
          description: string | null
          done: boolean
          done_at: string | null
          due_at: string | null
          entry_id: string
          id: string
          ord: number
          phase: string
          supplier_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          done?: boolean
          done_at?: string | null
          due_at?: string | null
          entry_id: string
          id?: string
          ord?: number
          phase?: string
          supplier_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          done?: boolean
          done_at?: string | null
          due_at?: string | null
          entry_id?: string
          id?: string
          ord?: number
          phase?: string
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_tasks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_tasks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_tasks_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      calendar_entries_for_participants: {
        Row: {
          created_at: string | null
          date_from: string | null
          date_to: string | null
          id: string | null
          owner_id: string | null
          quote_id: string | null
          status: Database["public"]["Enums"]["entry_status"] | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_from?: string | null
          date_to?: string | null
          id?: string | null
          owner_id?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"] | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_from?: string | null
          date_to?: string | null
          id?: string | null
          owner_id?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"] | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_entries_quote_fk"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_clients_dashboard: {
        Row: {
          created_at: string | null
          email: string | null
          event_date: string | null
          event_kind: string | null
          full_name: string | null
          id: string | null
          partner_name: string | null
          phone: string | null
          quote_count: number | null
          quoted_amount: number | null
          signed_contracts: number | null
          status: string | null
          supplier_id: string | null
          tags: string[] | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          event_date?: string | null
          event_kind?: string | null
          full_name?: string | null
          id?: string | null
          partner_name?: string | null
          phone?: string | null
          quote_count?: never
          quoted_amount?: never
          signed_contracts?: never
          status?: string | null
          supplier_id?: string | null
          tags?: string[] | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          event_date?: string | null
          event_kind?: string | null
          full_name?: string | null
          id?: string | null
          partner_name?: string | null
          phone?: string | null
          quote_count?: never
          quoted_amount?: never
          signed_contracts?: never
          status?: string | null
          supplier_id?: string | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_clients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_supplier_invite: { Args: { p_token: string }; Returns: boolean }
      admin_purge_deletion_requests: { Args: never; Returns: number }
      build_contract_sections: { Args: { p_quote_id: string }; Returns: Json }
      calcola_markup_effettivo: {
        Args: {
          p_item_markup: number
          p_quote_id: string
          p_supplier_id: string
        }
        Returns: number
      }
      check_supplier_available: {
        Args: { p_date: string; p_supplier: string }
        Returns: boolean
      }
      claim_supplier_invite: { Args: { p_token: string }; Returns: boolean }
      contract_get_by_token: { Args: { p_token: string }; Returns: Json }
      contract_sign_by_token: {
        Args: {
          p_signer_fiscal: string
          p_signer_name: string
          p_token: string
        }
        Returns: boolean
      }
      couple_accept_invite: { Args: { p_token: string }; Returns: boolean }
      has_active_collab_with_supplier: {
        Args: { p_supplier: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_collab_supplier_of_entry: {
        Args: { p_entry: string }
        Returns: boolean
      }
      is_entry_participant: { Args: { p_entry: string }; Returns: boolean }
      is_quote_owner: { Args: { p_quote: string }; Returns: boolean }
      is_service_owner: { Args: { p_service_id: string }; Returns: boolean }
      is_wedding_couple: { Args: { p_entry: string }; Returns: boolean }
      my_quote_conflict_alerts: {
        Args: never
        Returns: {
          conflict_severity: string
          match_signals: string[]
          my_quote_id: string
          my_quote_status: string
          my_quote_title: string
          my_quote_total: number
          my_role: string
          other_owner_name: string
          other_owner_role: string
          other_quote_event_date: string
          other_quote_id: string
          other_quote_status: string
          other_quote_total: number
        }[]
      }
      quote_accept_by_token: { Args: { p_token: string }; Returns: boolean }
      quote_get_by_token: { Args: { p_token: string }; Returns: Json }
      quote_pick_alternative: {
        Args: { p_item_id: string; p_token: string }
        Returns: boolean
      }
      quote_questionnaire_get: { Args: { p_token: string }; Returns: Json }
      quote_questionnaire_submit: {
        Args: { p_answers: Json; p_token: string }
        Returns: Json
      }
      quote_reject_by_token: {
        Args: { p_reason: string; p_token: string }
        Returns: boolean
      }
      quote_toggle_option: {
        Args: { p_item_id: string; p_selected: boolean; p_token: string }
        Returns: boolean
      }
      quote_track_event: {
        Args: { p_event: string; p_payload?: Json; p_token: string }
        Returns: undefined
      }
      quotes_recalc_totals: { Args: { p_quote_id: string }; Returns: undefined }
      request_account_deletion: { Args: never; Returns: boolean }
      resolve_couple_invite: { Args: { p_token: string }; Returns: Json }
      resolve_supplier_invite: { Args: { p_token: string }; Returns: Json }
      seed_user: {
        Args: {
          p_email: string
          p_id: string
          p_meta: Json
          p_password: string
        }
        Returns: undefined
      }
      supplier_invite_capostipite: { Args: { p_email: string }; Returns: Json }
      wedding_site_get: { Args: { p_slug: string }; Returns: Json }
      wedding_site_rsvp: {
        Args: {
          p_diet: string
          p_email: string
          p_full_name: string
          p_notes: string
          p_party: number
          p_rsvp: string
          p_slug: string
        }
        Returns: boolean
      }
    }
    Enums: {
      accommodation_kind:
        | "HOTEL"
        | "BNB"
        | "AIRBNB"
        | "VILLA_PRIVATA"
        | "APPARTAMENTO"
        | "RESORT"
      change_request_action: "CREATE" | "UPDATE" | "DELETE"
      change_request_entity:
        | "GUEST"
        | "TABLE"
        | "ACCOMMODATION"
        | "TRANSPORT"
        | "TIMELINE"
        | "SUBEVENT"
        | "WEBSITE"
        | "OTHER"
        | "MENU"
      change_request_status: "PENDING" | "APPROVED" | "REJECTED" | "APPLIED"
      collaboration_status: "PENDING" | "ACTIVE" | "REVOKED"
      contract_status: "BOZZA" | "INVIATO" | "FIRMATO" | "ANNULLATO"
      couple_role: "SPOSO" | "SPOSA" | "PARTNER" | "PERSONA_DI_FIDUCIA"
      entry_status:
        | "IN_TRATTATIVA"
        | "OPZIONATA"
        | "CONFERMATA"
        | "RIFIUTATA"
        | "CANCELLATA"
      gadget_kind:
        | "BOMBONIERA"
        | "CONFETTI"
        | "WELCOME_BAG"
        | "SAVE_THE_DATE"
        | "INVITO"
        | "MENU_STAMPATO"
        | "TABLEAU"
        | "SEGNAPOSTO"
        | "LIBRO_FIRME"
        | "RINGRAZIAMENTO"
        | "GADGET"
        | "ALTRO"
      menu_section_kind:
        | "BENVENUTO"
        | "ANTIPASTO"
        | "PRIMO"
        | "SECONDO"
        | "CONTORNO"
        | "FRUTTA"
        | "DOLCE"
        | "TORTA"
        | "CAFFE"
        | "BEVANDA"
        | "OPEN_BAR"
        | "CONFETTATA"
        | "ISOLA_BENVENUTO"
        | "ISOLA_PRECENA"
        | "ISOLA_DOPOCENA"
        | "ISOLA_SALUMI"
        | "ISOLA_FRITTI"
        | "ISOLA_PIZZA"
        | "ISOLA_PESCE_CRUDO"
        | "ISOLA_PASTA_LIVE"
        | "ISOLA_FORMAGGI"
        | "ISOLA_DOLCI"
        | "ISOLA_FRUTTA"
        | "ISOLA_CIOCCOLATO"
        | "SHOW_COOKING"
        | "CARRELLO_DISTILLATI"
        | "CARRELLO_SIGARI"
        | "CARRELLO_GIN_TONIC"
        | "CARRELLO_CAFFE_SPECIAL"
      modifier_type: "PERCENT" | "FIXED"
      pdf_variant: "NEUTRA" | "PREMIUM"
      profile_visibility: "PRIVATE" | "PUBLIC"
      quantity_basis: "FLAT" | "PER_GUEST" | "PER_TABLE" | "PER_HOUR"
      quote_status:
        | "BOZZA"
        | "INVIATO"
        | "ACCETTATO"
        | "RIFIUTATO"
        | "CONVERTITO_IN_CONTRATTO"
      rsvp_status: "PENDING" | "YES" | "NO" | "MAYBE"
      service_unit: "PEZZO" | "PERSONA" | "ORA" | "EVENTO"
      subevent_kind:
        | "ADDIO_NUBILATO"
        | "ADDIO_CELIBATO"
        | "PRE_WEDDING_SHOOT"
        | "ENGAGEMENT_PARTY"
        | "CENA_PROVE"
        | "REHEARSAL"
        | "WELCOME_DINNER"
        | "BRUNCH_POST"
        | "HONEYMOON_DEPART"
        | "BABY_SHOWER"
        | "ALTRO"
      subscription_tier: "FREE" | "PREMIUM"
      supplier_avail_status: "AVAILABLE" | "BUSY" | "TENTATIVE"
      transport_kind:
        | "AUTO_SPOSI"
        | "PULMINO_NAVETTA"
        | "AUTOBUS_GRUPPO"
        | "TRENO_GRUPPO"
        | "VOLO_GRUPPO"
        | "AUTO_NOLEGGIO"
        | "TAXI_NCC"
        | "BARCA"
        | "ALTRO"
      user_role:
        | "WEDDING_PLANNER"
        | "LOCATION"
        | "FORNITORE"
        | "ADMIN"
        | "COUPLE"
      wedding_style:
        | "CLASSICO"
        | "MODERNO"
        | "BOHO"
        | "RUSTICO"
        | "GLAMOUR"
        | "MINIMAL"
        | "VINTAGE"
        | "INDUSTRIALE"
        | "BEACH"
        | "MOUNTAIN"
        | "GARDEN"
        | "DESTINATION"
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
      accommodation_kind: [
        "HOTEL",
        "BNB",
        "AIRBNB",
        "VILLA_PRIVATA",
        "APPARTAMENTO",
        "RESORT",
      ],
      change_request_action: ["CREATE", "UPDATE", "DELETE"],
      change_request_entity: [
        "GUEST",
        "TABLE",
        "ACCOMMODATION",
        "TRANSPORT",
        "TIMELINE",
        "SUBEVENT",
        "WEBSITE",
        "OTHER",
        "MENU",
      ],
      change_request_status: ["PENDING", "APPROVED", "REJECTED", "APPLIED"],
      collaboration_status: ["PENDING", "ACTIVE", "REVOKED"],
      contract_status: ["BOZZA", "INVIATO", "FIRMATO", "ANNULLATO"],
      couple_role: ["SPOSO", "SPOSA", "PARTNER", "PERSONA_DI_FIDUCIA"],
      entry_status: [
        "IN_TRATTATIVA",
        "OPZIONATA",
        "CONFERMATA",
        "RIFIUTATA",
        "CANCELLATA",
      ],
      gadget_kind: [
        "BOMBONIERA",
        "CONFETTI",
        "WELCOME_BAG",
        "SAVE_THE_DATE",
        "INVITO",
        "MENU_STAMPATO",
        "TABLEAU",
        "SEGNAPOSTO",
        "LIBRO_FIRME",
        "RINGRAZIAMENTO",
        "GADGET",
        "ALTRO",
      ],
      menu_section_kind: [
        "BENVENUTO",
        "ANTIPASTO",
        "PRIMO",
        "SECONDO",
        "CONTORNO",
        "FRUTTA",
        "DOLCE",
        "TORTA",
        "CAFFE",
        "BEVANDA",
        "OPEN_BAR",
        "CONFETTATA",
        "ISOLA_BENVENUTO",
        "ISOLA_PRECENA",
        "ISOLA_DOPOCENA",
        "ISOLA_SALUMI",
        "ISOLA_FRITTI",
        "ISOLA_PIZZA",
        "ISOLA_PESCE_CRUDO",
        "ISOLA_PASTA_LIVE",
        "ISOLA_FORMAGGI",
        "ISOLA_DOLCI",
        "ISOLA_FRUTTA",
        "ISOLA_CIOCCOLATO",
        "SHOW_COOKING",
        "CARRELLO_DISTILLATI",
        "CARRELLO_SIGARI",
        "CARRELLO_GIN_TONIC",
        "CARRELLO_CAFFE_SPECIAL",
      ],
      modifier_type: ["PERCENT", "FIXED"],
      pdf_variant: ["NEUTRA", "PREMIUM"],
      profile_visibility: ["PRIVATE", "PUBLIC"],
      quantity_basis: ["FLAT", "PER_GUEST", "PER_TABLE", "PER_HOUR"],
      quote_status: [
        "BOZZA",
        "INVIATO",
        "ACCETTATO",
        "RIFIUTATO",
        "CONVERTITO_IN_CONTRATTO",
      ],
      rsvp_status: ["PENDING", "YES", "NO", "MAYBE"],
      service_unit: ["PEZZO", "PERSONA", "ORA", "EVENTO"],
      subevent_kind: [
        "ADDIO_NUBILATO",
        "ADDIO_CELIBATO",
        "PRE_WEDDING_SHOOT",
        "ENGAGEMENT_PARTY",
        "CENA_PROVE",
        "REHEARSAL",
        "WELCOME_DINNER",
        "BRUNCH_POST",
        "HONEYMOON_DEPART",
        "BABY_SHOWER",
        "ALTRO",
      ],
      subscription_tier: ["FREE", "PREMIUM"],
      supplier_avail_status: ["AVAILABLE", "BUSY", "TENTATIVE"],
      transport_kind: [
        "AUTO_SPOSI",
        "PULMINO_NAVETTA",
        "AUTOBUS_GRUPPO",
        "TRENO_GRUPPO",
        "VOLO_GRUPPO",
        "AUTO_NOLEGGIO",
        "TAXI_NCC",
        "BARCA",
        "ALTRO",
      ],
      user_role: [
        "WEDDING_PLANNER",
        "LOCATION",
        "FORNITORE",
        "ADMIN",
        "COUPLE",
      ],
      wedding_style: [
        "CLASSICO",
        "MODERNO",
        "BOHO",
        "RUSTICO",
        "GLAMOUR",
        "MINIMAL",
        "VINTAGE",
        "INDUSTRIALE",
        "BEACH",
        "MOUNTAIN",
        "GARDEN",
        "DESTINATION",
      ],
    },
  },
} as const
