export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
          client_email: string | null
          client_name: string | null
          created_at: string
          date_from: string
          date_to: string
          destination_country: string | null
          destination_language: string | null
          destination_location: string | null
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
          title: string
          updated_at: string
          value_amount: number | null
          wedding_website_data: Json
          wedding_website_published: boolean
          wedding_website_slug: string | null
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          date_from: string
          date_to: string
          destination_country?: string | null
          destination_language?: string | null
          destination_location?: string | null
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
          title: string
          updated_at?: string
          value_amount?: number | null
          wedding_website_data?: Json
          wedding_website_published?: boolean
          wedding_website_slug?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          date_from?: string
          date_to?: string
          destination_country?: string | null
          destination_language?: string | null
          destination_location?: string | null
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
          invite_token: string
          invited_at: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["collaboration_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          capostipite_id: string
          created_at?: string
          fornitore_id: string
          id?: string
          invite_token?: string
          invited_at?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["collaboration_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          capostipite_id?: string
          created_at?: string
          fornitore_id?: string
          id?: string
          invite_token?: string
          invited_at?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["collaboration_status"]
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
          entry_id: string | null
          event_date: string | null
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
          entry_id?: string | null
          event_date?: string | null
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
          entry_id?: string | null
          event_date?: string | null
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
      event_accommodations: {
        Row: {
          address: string | null
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
          updated_at: string
          url: string | null
        }
        Insert: {
          address?: string | null
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
          updated_at?: string
          url?: string | null
        }
        Update: {
          address?: string | null
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
      mood_images: {
        Row: {
          caption: string | null
          created_at: string
          entry_id: string
          id: string
          ord: number
          source: string | null
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
          brand_logo_url: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
          business_name: string | null
          created_at: string
          default_markup_percent: number
          full_name: string | null
          id: string
          notification_preferences: Json
          phone: string | null
          profile_visibility: Database["public"]["Enums"]["profile_visibility"]
          role: Database["public"]["Enums"]["user_role"]
          subrole: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          business_name?: string | null
          created_at?: string
          default_markup_percent?: number
          full_name?: string | null
          id: string
          notification_preferences?: Json
          phone?: string | null
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          role: Database["public"]["Enums"]["user_role"]
          subrole?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          business_name?: string | null
          created_at?: string
          default_markup_percent?: number
          full_name?: string | null
          id?: string
          notification_preferences?: Json
          phone?: string | null
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          role?: Database["public"]["Enums"]["user_role"]
          subrole?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
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
          event_date: string | null
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
          event_date?: string | null
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
          event_date?: string | null
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
    }
    Functions: {
      calcola_markup_effettivo: {
        Args: {
          p_item_markup: number
          p_quote_id: string
          p_supplier_id: string
        }
        Returns: number
      }
      contract_get_by_token: { Args: { p_token: string }; Returns: Json }
      contract_sign_by_token: {
        Args: {
          p_signer_fiscal: string
          p_signer_name: string
          p_token: string
        }
        Returns: boolean
      }
      has_active_collab_with_supplier: {
        Args: { p_supplier: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_entry_participant: { Args: { p_entry: string }; Returns: boolean }
      is_quote_owner: { Args: { p_quote: string }; Returns: boolean }
      quote_accept_by_token: { Args: { p_token: string }; Returns: boolean }
      quote_get_by_token: { Args: { p_token: string }; Returns: Json }
      quote_pick_alternative: {
        Args: { p_item_id: string; p_token: string }
        Returns: boolean
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
      seed_user: {
        Args: {
          p_email: string
          p_id: string
          p_meta: Json
          p_password: string
        }
        Returns: undefined
      }
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
      collaboration_status: "PENDING" | "ACTIVE" | "REVOKED"
      contract_status: "BOZZA" | "INVIATO" | "FIRMATO" | "ANNULLATO"
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
      user_role: "WEDDING_PLANNER" | "LOCATION" | "FORNITORE" | "ADMIN"
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
      collaboration_status: ["PENDING", "ACTIVE", "REVOKED"],
      contract_status: ["BOZZA", "INVIATO", "FIRMATO", "ANNULLATO"],
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
      user_role: ["WEDDING_PLANNER", "LOCATION", "FORNITORE", "ADMIN"],
    },
  },
} as const

