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
      audit_log: {
        Row: {
          eseguito_da: string | null
          eseguito_il: string
          id: number
          operazione: string
          record_id: string | null
          tabella: string
          valori_dopo: Json | null
          valori_prima: Json | null
        }
        Insert: {
          eseguito_da?: string | null
          eseguito_il?: string
          id?: never
          operazione: string
          record_id?: string | null
          tabella: string
          valori_dopo?: Json | null
          valori_prima?: Json | null
        }
        Update: {
          eseguito_da?: string | null
          eseguito_il?: string
          id?: never
          operazione?: string
          record_id?: string | null
          tabella?: string
          valori_dopo?: Json | null
          valori_prima?: Json | null
        }
        Relationships: []
      }
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
      blog_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string
          body_html: string
          category_id: string | null
          created_at: string
          excerpt: string | null
          hero_focal_y: number | null
          hero_image_url: string | null
          id: string
          published_at: string | null
          reading_minutes: number | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id: string
          body_html?: string
          category_id?: string | null
          created_at?: string
          excerpt?: string | null
          hero_focal_y?: number | null
          hero_image_url?: string | null
          id?: string
          published_at?: string | null
          reading_minutes?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string
          body_html?: string
          category_id?: string | null
          created_at?: string
          excerpt?: string | null
          hero_focal_y?: number | null
          hero_image_url?: string | null
          id?: string
          published_at?: string | null
          reading_minutes?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "budget_categories_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "budget_categories_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
            foreignKeyName: "budget_entries_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "budget_entries_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "budget_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      calendar_entries: {
        Row: {
          ambito_capostipite:
            | Database["public"]["Enums"]["ambito_capostipite"]
            | null
          business_model: string
          ceremony_city: string | null
          ceremony_contact_email: string | null
          ceremony_contact_name: string | null
          ceremony_contact_phone: string | null
          ceremony_date: string | null
          ceremony_notes: string | null
          ceremony_status: Database["public"]["Enums"]["ceremony_status"]
          ceremony_type: Database["public"]["Enums"]["ceremony_type"] | null
          ceremony_venue_address: string | null
          ceremony_venue_name: string | null
          client_email: string | null
          client_name: string | null
          created_at: string
          date_from: string
          date_to: string
          destination_country: string | null
          destination_language: string | null
          destination_location: string | null
          event_kind: string
          evento_stato: Database["public"]["Enums"]["evento_stato"]
          honeymoon_destination: string | null
          honeymoon_end: string | null
          honeymoon_notes: string | null
          honeymoon_start: string | null
          id: string
          is_destination: boolean
          modalita_incasso:
            | Database["public"]["Enums"]["modalita_incasso"]
            | null
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
          ambito_capostipite?:
            | Database["public"]["Enums"]["ambito_capostipite"]
            | null
          business_model?: string
          ceremony_city?: string | null
          ceremony_contact_email?: string | null
          ceremony_contact_name?: string | null
          ceremony_contact_phone?: string | null
          ceremony_date?: string | null
          ceremony_notes?: string | null
          ceremony_status?: Database["public"]["Enums"]["ceremony_status"]
          ceremony_type?: Database["public"]["Enums"]["ceremony_type"] | null
          ceremony_venue_address?: string | null
          ceremony_venue_name?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          date_from: string
          date_to: string
          destination_country?: string | null
          destination_language?: string | null
          destination_location?: string | null
          event_kind?: string
          evento_stato?: Database["public"]["Enums"]["evento_stato"]
          honeymoon_destination?: string | null
          honeymoon_end?: string | null
          honeymoon_notes?: string | null
          honeymoon_start?: string | null
          id?: string
          is_destination?: boolean
          modalita_incasso?:
            | Database["public"]["Enums"]["modalita_incasso"]
            | null
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
          ambito_capostipite?:
            | Database["public"]["Enums"]["ambito_capostipite"]
            | null
          business_model?: string
          ceremony_city?: string | null
          ceremony_contact_email?: string | null
          ceremony_contact_name?: string | null
          ceremony_contact_phone?: string | null
          ceremony_date?: string | null
          ceremony_notes?: string | null
          ceremony_status?: Database["public"]["Enums"]["ceremony_status"]
          ceremony_type?: Database["public"]["Enums"]["ceremony_type"] | null
          ceremony_venue_address?: string | null
          ceremony_venue_name?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          date_from?: string
          date_to?: string
          destination_country?: string | null
          destination_language?: string | null
          destination_location?: string | null
          event_kind?: string
          evento_stato?: Database["public"]["Enums"]["evento_stato"]
          honeymoon_destination?: string | null
          honeymoon_end?: string | null
          honeymoon_notes?: string | null
          honeymoon_start?: string | null
          id?: string
          is_destination?: boolean
          modalita_incasso?:
            | Database["public"]["Enums"]["modalita_incasso"]
            | null
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
            foreignKeyName: "calendar_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
            foreignKeyName: "calendar_entry_participants_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "calendar_entry_participants_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "calendar_entry_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_entry_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
          {
            foreignKeyName: "calendar_export_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      chat_messaggi: {
        Row: {
          allegato_url: string | null
          corpo: string
          creato_il: string
          entry_id: string
          id: string
          letto_il: string | null
          mittente_id: string
          voce_quote_item_id: string | null
        }
        Insert: {
          allegato_url?: string | null
          corpo: string
          creato_il?: string
          entry_id: string
          id?: string
          letto_il?: string | null
          mittente_id: string
          voce_quote_item_id?: string | null
        }
        Update: {
          allegato_url?: string | null
          corpo?: string
          creato_il?: string
          entry_id?: string
          id?: string
          letto_il?: string | null
          mittente_id?: string
          voce_quote_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messaggi_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messaggi_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messaggi_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "chat_messaggi_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "chat_messaggi_mittente_id_fkey"
            columns: ["mittente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messaggi_mittente_id_fkey"
            columns: ["mittente_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "chat_messaggi_voce_quote_item_id_fkey"
            columns: ["voce_quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template: {
        Row: {
          created_at: string
          id: string
          momento: string | null
          professione_id: string
          sort_order: number | null
          voce: string
        }
        Insert: {
          created_at?: string
          id?: string
          momento?: string | null
          professione_id: string
          sort_order?: number | null
          voce: string
        }
        Update: {
          created_at?: string
          id?: string
          momento?: string | null
          professione_id?: string
          sort_order?: number | null
          voce?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_professione_id_fkey"
            columns: ["professione_id"]
            isOneToOne: false
            referencedRelation: "professioni"
            referencedColumns: ["id"]
          },
        ]
      }
      clausola_template: {
        Row: {
          body: string
          categoria: string | null
          created_at: string
          id: string
          per_modalita: string | null
          professione_id: string
          sort_order: number | null
          titolo: string
        }
        Insert: {
          body: string
          categoria?: string | null
          created_at?: string
          id?: string
          per_modalita?: string | null
          professione_id: string
          sort_order?: number | null
          titolo: string
        }
        Update: {
          body?: string
          categoria?: string | null
          created_at?: string
          id?: string
          per_modalita?: string | null
          professione_id?: string
          sort_order?: number | null
          titolo?: string
        }
        Relationships: [
          {
            foreignKeyName: "clausola_template_professione_id_fkey"
            columns: ["professione_id"]
            isOneToOne: false
            referencedRelation: "professioni"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_ratings: {
        Row: {
          created_at: string
          entry_id: string | null
          id: string
          rated_id: string
          rater_id: string
          review: string | null
          stars: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_id?: string | null
          id?: string
          rated_id: string
          rater_id: string
          review?: string | null
          stars: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_id?: string | null
          id?: string
          rated_id?: string
          rater_id?: string
          review?: string | null
          stars?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_ratings_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_ratings_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_ratings_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "collaboration_ratings_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "collaboration_ratings_rated_id_fkey"
            columns: ["rated_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_ratings_rated_id_fkey"
            columns: ["rated_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "collaboration_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
            foreignKeyName: "collaborations_capostipite_id_fkey"
            columns: ["capostipite_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "collaborations_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborations_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      consenso_segnalazione: {
        Row: {
          couple_user_id: string
          created_at: string
          dato_il: string | null
          entry_id: string
          id: string
          note: string | null
          revocato_il: string | null
          supplier_id: string
          updated_at: string
          versione: string
        }
        Insert: {
          couple_user_id: string
          created_at?: string
          dato_il?: string | null
          entry_id: string
          id?: string
          note?: string | null
          revocato_il?: string | null
          supplier_id: string
          updated_at?: string
          versione?: string
        }
        Update: {
          couple_user_id?: string
          created_at?: string
          dato_il?: string | null
          entry_id?: string
          id?: string
          note?: string | null
          revocato_il?: string | null
          supplier_id?: string
          updated_at?: string
          versione?: string
        }
        Relationships: [
          {
            foreignKeyName: "consenso_segnalazione_couple_user_id_fkey"
            columns: ["couple_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consenso_segnalazione_couple_user_id_fkey"
            columns: ["couple_user_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "consenso_segnalazione_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consenso_segnalazione_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consenso_segnalazione_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "consenso_segnalazione_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "consenso_segnalazione_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consenso_segnalazione_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      consiglio: {
        Row: {
          contesto: string
          created_at: string
          id: string
          professione_id: string
          sort_order: number | null
          testo: string
          titolo: string
        }
        Insert: {
          contesto: string
          created_at?: string
          id?: string
          professione_id: string
          sort_order?: number | null
          testo: string
          titolo: string
        }
        Update: {
          contesto?: string
          created_at?: string
          id?: string
          professione_id?: string
          sort_order?: number | null
          testo?: string
          titolo?: string
        }
        Relationships: [
          {
            foreignKeyName: "consiglio_professione_id_fkey"
            columns: ["professione_id"]
            isOneToOne: false
            referencedRelation: "professioni"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          client_address: string | null
          client_business_name: string | null
          client_city: string | null
          client_country: string | null
          client_email: string | null
          client_fiscal_code: string | null
          client_name: string | null
          client_pec_email: string | null
          client_province: string | null
          client_sdi_code: string | null
          client_vat_number: string | null
          client_zip: string | null
          countersign_at: string | null
          countersign_data: Json | null
          created_at: string
          direct_client_id: string | null
          entry_id: string | null
          event_date: string | null
          event_kind: string
          id: string
          owner_id: string
          party_kind: Database["public"]["Enums"]["contract_party_kind"]
          pdf_url: string | null
          quote_id: string | null
          sections: Json
          signature_data: Json | null
          signed_at: string | null
          signed_offline: boolean
          signed_offline_at: string | null
          signed_offline_notes: string | null
          signed_offline_pdf_url: string | null
          signed_offline_signer_name: string | null
          status: Database["public"]["Enums"]["contract_status"]
          supplier_id: string | null
          template_id: string | null
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          client_address?: string | null
          client_business_name?: string | null
          client_city?: string | null
          client_country?: string | null
          client_email?: string | null
          client_fiscal_code?: string | null
          client_name?: string | null
          client_pec_email?: string | null
          client_province?: string | null
          client_sdi_code?: string | null
          client_vat_number?: string | null
          client_zip?: string | null
          countersign_at?: string | null
          countersign_data?: Json | null
          created_at?: string
          direct_client_id?: string | null
          entry_id?: string | null
          event_date?: string | null
          event_kind?: string
          id?: string
          owner_id: string
          party_kind?: Database["public"]["Enums"]["contract_party_kind"]
          pdf_url?: string | null
          quote_id?: string | null
          sections?: Json
          signature_data?: Json | null
          signed_at?: string | null
          signed_offline?: boolean
          signed_offline_at?: string | null
          signed_offline_notes?: string | null
          signed_offline_pdf_url?: string | null
          signed_offline_signer_name?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          supplier_id?: string | null
          template_id?: string | null
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          client_address?: string | null
          client_business_name?: string | null
          client_city?: string | null
          client_country?: string | null
          client_email?: string | null
          client_fiscal_code?: string | null
          client_name?: string | null
          client_pec_email?: string | null
          client_province?: string | null
          client_sdi_code?: string | null
          client_vat_number?: string | null
          client_zip?: string | null
          countersign_at?: string | null
          countersign_data?: Json | null
          created_at?: string
          direct_client_id?: string | null
          entry_id?: string | null
          event_date?: string | null
          event_kind?: string
          id?: string
          owner_id?: string
          party_kind?: Database["public"]["Enums"]["contract_party_kind"]
          pdf_url?: string | null
          quote_id?: string | null
          sections?: Json
          signature_data?: Json | null
          signed_at?: string | null
          signed_offline?: boolean
          signed_offline_at?: string | null
          signed_offline_notes?: string | null
          signed_offline_pdf_url?: string | null
          signed_offline_signer_name?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          supplier_id?: string | null
          template_id?: string | null
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
            foreignKeyName: "contracts_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "contracts_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "contracts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
            foreignKeyName: "couple_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "couple_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
          {
            foreignKeyName: "couple_change_requests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "couple_change_requests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      couple_preferences: {
        Row: {
          additional_notes: string | null
          already_booked: Json
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
          planning_stage:
            | Database["public"]["Enums"]["couple_planning_stage"]
            | null
          preferred_palette: string[] | null
          preferred_season: string | null
          questionnaire_completed_at: string | null
          styles: Database["public"]["Enums"]["wedding_style"][] | null
          updated_at: string
          urgency: Database["public"]["Enums"]["couple_urgency"] | null
          vision_note: string | null
        }
        Insert: {
          additional_notes?: string | null
          already_booked?: Json
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
          planning_stage?:
            | Database["public"]["Enums"]["couple_planning_stage"]
            | null
          preferred_palette?: string[] | null
          preferred_season?: string | null
          questionnaire_completed_at?: string | null
          styles?: Database["public"]["Enums"]["wedding_style"][] | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["couple_urgency"] | null
          vision_note?: string | null
        }
        Update: {
          additional_notes?: string | null
          already_booked?: Json
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
          planning_stage?:
            | Database["public"]["Enums"]["couple_planning_stage"]
            | null
          preferred_palette?: string[] | null
          preferred_season?: string | null
          questionnaire_completed_at?: string | null
          styles?: Database["public"]["Enums"]["wedding_style"][] | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["couple_urgency"] | null
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
          {
            foreignKeyName: "couple_preferences_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "couple_preferences_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
          {
            foreignKeyName: "event_accommodations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_accommodations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
            foreignKeyName: "event_documents_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_documents_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
            foreignKeyName: "event_gadgets_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_gadgets_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_gadgets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_gadgets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
            foreignKeyName: "event_guest_accommodation_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_guest_accommodation_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
            foreignKeyName: "event_guest_transport_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_guest_transport_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
          accessibility_needs: string[]
          accessibility_notes: string | null
          accommodation_id: string | null
          age_group: Database["public"]["Enums"]["guest_age_group"]
          arrival_at: string | null
          created_at: string
          departure_at: string | null
          diet: string | null
          email: string | null
          entry_id: string
          full_name: string
          group_label: string | null
          high_chair_needed: boolean
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
          accessibility_needs?: string[]
          accessibility_notes?: string | null
          accommodation_id?: string | null
          age_group?: Database["public"]["Enums"]["guest_age_group"]
          arrival_at?: string | null
          created_at?: string
          departure_at?: string | null
          diet?: string | null
          email?: string | null
          entry_id: string
          full_name: string
          group_label?: string | null
          high_chair_needed?: boolean
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
          accessibility_needs?: string[]
          accessibility_notes?: string | null
          accommodation_id?: string | null
          age_group?: Database["public"]["Enums"]["guest_age_group"]
          arrival_at?: string | null
          created_at?: string
          departure_at?: string | null
          diet?: string | null
          email?: string | null
          entry_id?: string
          full_name?: string
          group_label?: string | null
          high_chair_needed?: boolean
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
            foreignKeyName: "event_guests_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_guests_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
          included_in_package: boolean
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
          included_in_package?: boolean
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
          included_in_package?: boolean
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
            foreignKeyName: "event_menu_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_menu_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_menu_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_menu_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
          {
            foreignKeyName: "event_playlist_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_playlist_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
          {
            foreignKeyName: "event_subevents_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_subevents_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
          {
            foreignKeyName: "event_tables_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_tables_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
            foreignKeyName: "event_timeline_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_timeline_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_timeline_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_timeline_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
          {
            foreignKeyName: "event_transport_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "event_transport_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
      eventi_cambiamento: {
        Row: {
          entry_id: string
          eseguito_da: string | null
          eseguito_il: string
          id: string
          payload: Json
          stato: Database["public"]["Enums"]["evento_cambiamento_stato"]
          tipo: Database["public"]["Enums"]["evento_cambiamento_tipo"]
        }
        Insert: {
          entry_id: string
          eseguito_da?: string | null
          eseguito_il?: string
          id?: string
          payload?: Json
          stato?: Database["public"]["Enums"]["evento_cambiamento_stato"]
          tipo: Database["public"]["Enums"]["evento_cambiamento_tipo"]
        }
        Update: {
          entry_id?: string
          eseguito_da?: string | null
          eseguito_il?: string
          id?: string
          payload?: Json
          stato?: Database["public"]["Enums"]["evento_cambiamento_stato"]
          tipo?: Database["public"]["Enums"]["evento_cambiamento_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "eventi_cambiamento_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventi_cambiamento_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventi_cambiamento_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "eventi_cambiamento_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "eventi_cambiamento_eseguito_da_fkey"
            columns: ["eseguito_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventi_cambiamento_eseguito_da_fkey"
            columns: ["eseguito_da"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
            foreignKeyName: "finance_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
      follows: {
        Row: {
          created_at: string
          decided_at: string | null
          followed_id: string
          follower_id: string
          status: Database["public"]["Enums"]["follow_status"]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          followed_id: string
          follower_id: string
          status?: Database["public"]["Enums"]["follow_status"]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          followed_id?: string
          follower_id?: string
          status?: Database["public"]["Enums"]["follow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "follows_followed_id_fkey"
            columns: ["followed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_followed_id_fkey"
            columns: ["followed_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
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
            foreignKeyName: "insurance_policies_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "insurance_policies_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
      lead_requests: {
        Row: {
          billed_amount: number | null
          billed_at: string | null
          billing_note: string | null
          budget_range: string | null
          client_email: string
          client_name: string
          client_phone: string | null
          close_amount: number | null
          close_notes: string | null
          closed_at: string | null
          contacted_at: string | null
          created_at: string
          event_date: string | null
          event_kind: string
          event_location: string | null
          guests_estimate: number | null
          honeypot_field: string | null
          id: string
          ip_address: unknown
          is_billable: boolean
          message: string | null
          quoted_at: string | null
          source: string | null
          status: string
          updated_at: string
          user_agent: string | null
          viewed_at: string | null
          wp_id: string
        }
        Insert: {
          billed_amount?: number | null
          billed_at?: string | null
          billing_note?: string | null
          budget_range?: string | null
          client_email: string
          client_name: string
          client_phone?: string | null
          close_amount?: number | null
          close_notes?: string | null
          closed_at?: string | null
          contacted_at?: string | null
          created_at?: string
          event_date?: string | null
          event_kind?: string
          event_location?: string | null
          guests_estimate?: number | null
          honeypot_field?: string | null
          id?: string
          ip_address?: unknown
          is_billable?: boolean
          message?: string | null
          quoted_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          viewed_at?: string | null
          wp_id: string
        }
        Update: {
          billed_amount?: number | null
          billed_at?: string | null
          billing_note?: string | null
          budget_range?: string | null
          client_email?: string
          client_name?: string
          client_phone?: string | null
          close_amount?: number | null
          close_notes?: string | null
          closed_at?: string | null
          contacted_at?: string | null
          created_at?: string
          event_date?: string | null
          event_kind?: string
          event_location?: string | null
          guests_estimate?: number | null
          honeypot_field?: string | null
          id?: string
          ip_address?: unknown
          is_billable?: boolean
          message?: string | null
          quoted_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          viewed_at?: string | null
          wp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_requests_wp_id_fkey"
            columns: ["wp_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_requests_wp_id_fkey"
            columns: ["wp_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      lead_submit_attempts: {
        Row: {
          attempted_at: string
          ip_address: unknown
          wp_slug: string | null
        }
        Insert: {
          attempted_at?: string
          ip_address?: unknown
          wp_slug?: string | null
        }
        Update: {
          attempted_at?: string
          ip_address?: unknown
          wp_slug?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "mood_images_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "mood_images_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      mood_inspirations: {
        Row: {
          category: string
          created_at: string
          entry_id: string
          free_notes: string | null
          id: string
          instagram_refs: string[]
          mood_words: string[]
          pinterest_url: string | null
          quote_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          entry_id: string
          free_notes?: string | null
          id?: string
          instagram_refs?: string[]
          mood_words?: string[]
          pinterest_url?: string | null
          quote_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          entry_id?: string
          free_notes?: string | null
          id?: string
          instagram_refs?: string[]
          mood_words?: string[]
          pinterest_url?: string | null
          quote_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_inspirations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mood_inspirations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mood_inspirations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "mood_inspirations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "mood_inspirations_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
          {
            foreignKeyName: "notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      notifiche: {
        Row: {
          creato_il: string
          descrizione: string | null
          destinatario_id: string
          evento_id: string | null
          id: string
          letto_il: string | null
          link_action: string | null
          owner_della_mossa: string | null
          priorita: number
          relativa_a_data_nozze_giorni: number | null
          scadenza_il: string | null
          stato: string
          tipo: string
          titolo: string
        }
        Insert: {
          creato_il?: string
          descrizione?: string | null
          destinatario_id: string
          evento_id?: string | null
          id?: string
          letto_il?: string | null
          link_action?: string | null
          owner_della_mossa?: string | null
          priorita?: number
          relativa_a_data_nozze_giorni?: number | null
          scadenza_il?: string | null
          stato?: string
          tipo: string
          titolo: string
        }
        Update: {
          creato_il?: string
          descrizione?: string | null
          destinatario_id?: string
          evento_id?: string | null
          id?: string
          letto_il?: string | null
          link_action?: string | null
          owner_della_mossa?: string | null
          priorita?: number
          relativa_a_data_nozze_giorni?: number | null
          scadenza_il?: string | null
          stato?: string
          tipo?: string
          titolo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifiche_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiche_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "notifiche_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiche_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiche_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "notifiche_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "notifiche_owner_della_mossa_fkey"
            columns: ["owner_della_mossa"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiche_owner_della_mossa_fkey"
            columns: ["owner_della_mossa"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          body_html: string | null
          comment_count: number
          cover_image_url: string | null
          created_at: string
          event_id: string | null
          id: string
          is_pinned: boolean
          like_count: number
          link_preview: Json | null
          link_url: string | null
          media_urls: string[]
          post_type: string
          slug: string | null
          tagged_supplier_ids: string[]
          title: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id: string
          body: string
          body_html?: string | null
          comment_count?: number
          cover_image_url?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          is_pinned?: boolean
          like_count?: number
          link_preview?: Json | null
          link_url?: string | null
          media_urls?: string[]
          post_type?: string
          slug?: string | null
          tagged_supplier_ids?: string[]
          title?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          body?: string
          body_html?: string | null
          comment_count?: number
          cover_image_url?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          is_pinned?: boolean
          like_count?: number
          link_preview?: Json | null
          link_url?: string | null
          media_urls?: string[]
          post_type?: string
          slug?: string | null
          tagged_supplier_ids?: string[]
          title?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
      professioni: {
        Row: {
          attiva: boolean
          created_at: string
          etichette: Json
          gruppo: string
          icona: string | null
          id: string
          nome: string
          slug: string
          sort_order: number
          unita_default: Json
        }
        Insert: {
          attiva?: boolean
          created_at?: string
          etichette?: Json
          gruppo: string
          icona?: string | null
          id?: string
          nome: string
          slug: string
          sort_order?: number
          unita_default?: Json
        }
        Update: {
          attiva?: boolean
          created_at?: string
          etichette?: Json
          gruppo?: string
          icona?: string | null
          id?: string
          nome?: string
          slug?: string
          sort_order?: number
          unita_default?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          applica_ricarico_default: boolean
          bio: string | null
          brand_logo_url: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
          business_legal_name: string | null
          business_name: string | null
          capacita_secondarie: string[]
          city: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          default_markup_percent: number
          deletion_requested_at: string | null
          discover_tier: string | null
          facebook: string | null
          fiscal_code: string | null
          founding_member_at: string | null
          full_name: string | null
          id: string
          instagram: string | null
          is_discoverable: boolean
          is_founding_member: boolean
          legal_form: Database["public"]["Enums"]["legal_form"] | null
          marketing_consent_at: string | null
          modalita_incasso_default:
            | Database["public"]["Enums"]["modalita_incasso"]
            | null
          notification_preferences: Json
          nuovo_modello_attivo: boolean
          offers_full_dining: boolean
          onboarding_completato_il: string | null
          onboarding_complete: boolean
          parcella_default: number | null
          pec_email: string | null
          phone: string | null
          privacy_consent_at: string | null
          professione_id: string | null
          profile_visibility: Database["public"]["Enums"]["profile_visibility"]
          province: string | null
          referral_code: string | null
          referred_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          sdi_code: string | null
          service_radius_km: number | null
          slug: string | null
          subrole: string | null
          subscription_renews_at: string | null
          subscription_status: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          tagline: string | null
          tiktok: string | null
          trial_started_at: string | null
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
          applica_ricarico_default?: boolean
          bio?: string | null
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          business_legal_name?: string | null
          business_name?: string | null
          capacita_secondarie?: string[]
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          default_markup_percent?: number
          deletion_requested_at?: string | null
          discover_tier?: string | null
          facebook?: string | null
          fiscal_code?: string | null
          founding_member_at?: string | null
          full_name?: string | null
          id: string
          instagram?: string | null
          is_discoverable?: boolean
          is_founding_member?: boolean
          legal_form?: Database["public"]["Enums"]["legal_form"] | null
          marketing_consent_at?: string | null
          modalita_incasso_default?:
            | Database["public"]["Enums"]["modalita_incasso"]
            | null
          notification_preferences?: Json
          nuovo_modello_attivo?: boolean
          offers_full_dining?: boolean
          onboarding_completato_il?: string | null
          onboarding_complete?: boolean
          parcella_default?: number | null
          pec_email?: string | null
          phone?: string | null
          privacy_consent_at?: string | null
          professione_id?: string | null
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          province?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role: Database["public"]["Enums"]["user_role"]
          sdi_code?: string | null
          service_radius_km?: number | null
          slug?: string | null
          subrole?: string | null
          subscription_renews_at?: string | null
          subscription_status?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          tagline?: string | null
          tiktok?: string | null
          trial_started_at?: string | null
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
          applica_ricarico_default?: boolean
          bio?: string | null
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          business_legal_name?: string | null
          business_name?: string | null
          capacita_secondarie?: string[]
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          default_markup_percent?: number
          deletion_requested_at?: string | null
          discover_tier?: string | null
          facebook?: string | null
          fiscal_code?: string | null
          founding_member_at?: string | null
          full_name?: string | null
          id?: string
          instagram?: string | null
          is_discoverable?: boolean
          is_founding_member?: boolean
          legal_form?: Database["public"]["Enums"]["legal_form"] | null
          marketing_consent_at?: string | null
          modalita_incasso_default?:
            | Database["public"]["Enums"]["modalita_incasso"]
            | null
          notification_preferences?: Json
          nuovo_modello_attivo?: boolean
          offers_full_dining?: boolean
          onboarding_completato_il?: string | null
          onboarding_complete?: boolean
          parcella_default?: number | null
          pec_email?: string | null
          phone?: string | null
          privacy_consent_at?: string | null
          professione_id?: string | null
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          province?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sdi_code?: string | null
          service_radius_km?: number | null
          slug?: string | null
          subrole?: string | null
          subscription_renews_at?: string | null
          subscription_status?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          tagline?: string | null
          tiktok?: string | null
          trial_started_at?: string | null
          tutorial_state?: Json
          updated_at?: string
          vat_number?: string | null
          website?: string | null
          work_style?: string | null
          years_active?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_professione_id_fkey"
            columns: ["professione_id"]
            isOneToOne: false
            referencedRelation: "professioni"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_acceptances: {
        Row: {
          acceptance_pdf_url: string | null
          accepted_at: string
          access_token: string
          client_address: string | null
          client_business_name: string | null
          client_city: string | null
          client_country: string | null
          client_fiscal_code: string | null
          client_pec_email: string | null
          client_province: string | null
          client_sdi_code: string | null
          client_vat_number: string | null
          client_zip: string | null
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
          client_address?: string | null
          client_business_name?: string | null
          client_city?: string | null
          client_country?: string | null
          client_fiscal_code?: string | null
          client_pec_email?: string | null
          client_province?: string | null
          client_sdi_code?: string | null
          client_vat_number?: string | null
          client_zip?: string | null
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
          client_address?: string | null
          client_business_name?: string | null
          client_city?: string | null
          client_country?: string | null
          client_fiscal_code?: string | null
          client_pec_email?: string | null
          client_province?: string | null
          client_sdi_code?: string | null
          client_vat_number?: string | null
          client_zip?: string | null
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
          erogatore_e_capostipite: boolean
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
          supplier_confirmed_at: string | null
          supplier_confirmed_by: string | null
          supplier_id: string | null
          unit_snapshot: Database["public"]["Enums"]["service_unit"]
          updated_at: string
        }
        Insert: {
          alternative_group?: string | null
          client_selected_at?: string | null
          created_at?: string
          description_snapshot?: string | null
          erogatore_e_capostipite?: boolean
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
          supplier_confirmed_at?: string | null
          supplier_confirmed_by?: string | null
          supplier_id?: string | null
          unit_snapshot?: Database["public"]["Enums"]["service_unit"]
          updated_at?: string
        }
        Update: {
          alternative_group?: string | null
          client_selected_at?: string | null
          created_at?: string
          description_snapshot?: string | null
          erogatore_e_capostipite?: boolean
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
          supplier_confirmed_at?: string | null
          supplier_confirmed_by?: string | null
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
            foreignKeyName: "quote_items_supplier_confirmed_by_fkey"
            columns: ["supplier_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_supplier_confirmed_by_fkey"
            columns: ["supplier_confirmed_by"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "quote_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
          {
            foreignKeyName: "quote_supplier_markups_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
          access_token_expires_at: string | null
          client_email: string | null
          client_name: string | null
          client_response_log: Json
          created_at: string
          default_markup_percent: number
          direct_client_id: string | null
          event_date: string | null
          event_kind: string
          event_location: string | null
          forced_without_questionnaire: boolean
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
          access_token_expires_at?: string | null
          client_email?: string | null
          client_name?: string | null
          client_response_log?: Json
          created_at?: string
          default_markup_percent?: number
          direct_client_id?: string | null
          event_date?: string | null
          event_kind?: string
          event_location?: string | null
          forced_without_questionnaire?: boolean
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
          access_token_expires_at?: string | null
          client_email?: string | null
          client_name?: string | null
          client_response_log?: Json
          created_at?: string
          default_markup_percent?: number
          direct_client_id?: string | null
          event_date?: string | null
          event_kind?: string
          event_location?: string | null
          forced_without_questionnaire?: boolean
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
          {
            foreignKeyName: "quotes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      referral_credits: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          description: string | null
          id: string
          paid_at: string | null
          period: string | null
          reason: string
          referral_id: string | null
          status: string
          wp_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          period?: string | null
          reason: string
          referral_id?: string | null
          status?: string
          wp_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          period?: string | null
          reason?: string
          referral_id?: string | null
          status?: string
          wp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_credits_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_credits_wp_id_fkey"
            columns: ["wp_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_credits_wp_id_fkey"
            columns: ["wp_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      referral_redeem_attempts: {
        Row: {
          attempted_at: string
          code: string | null
          success: boolean
          user_id: string
        }
        Insert: {
          attempted_at?: string
          code?: string | null
          success?: boolean
          user_id: string
        }
        Update: {
          attempted_at?: string
          code?: string | null
          success?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_redeem_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_redeem_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      referrals: {
        Row: {
          code_used: string | null
          created_at: string
          id: string
          referee_id: string
          referee_role: Database["public"]["Enums"]["user_role"]
          referrer_id: string
          source: string
          status: string
          terminated_at: string | null
          tier_at_creation: string | null
          updated_at: string
        }
        Insert: {
          code_used?: string | null
          created_at?: string
          id?: string
          referee_id: string
          referee_role: Database["public"]["Enums"]["user_role"]
          referrer_id: string
          source?: string
          status?: string
          terminated_at?: string | null
          tier_at_creation?: string | null
          updated_at?: string
        }
        Update: {
          code_used?: string | null
          created_at?: string
          id?: string
          referee_id?: string
          referee_role?: Database["public"]["Enums"]["user_role"]
          referrer_id?: string
          source?: string
          status?: string
          terminated_at?: string | null
          tier_at_creation?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      scadenzario_voci: {
        Row: {
          created_at: string
          creditore_id: string | null
          debitore_id: string | null
          descrizione: string | null
          entry_id: string
          id: string
          importo_eur: number
          metodo: string | null
          note: string | null
          pagato: boolean
          pagato_il: string | null
          scadenza: string | null
          tipo: Database["public"]["Enums"]["scadenza_tipo"]
          titolo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creditore_id?: string | null
          debitore_id?: string | null
          descrizione?: string | null
          entry_id: string
          id?: string
          importo_eur: number
          metodo?: string | null
          note?: string | null
          pagato?: boolean
          pagato_il?: string | null
          scadenza?: string | null
          tipo: Database["public"]["Enums"]["scadenza_tipo"]
          titolo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creditore_id?: string | null
          debitore_id?: string | null
          descrizione?: string | null
          entry_id?: string
          id?: string
          importo_eur?: number
          metodo?: string | null
          note?: string | null
          pagato?: boolean
          pagato_il?: string | null
          scadenza?: string | null
          tipo?: Database["public"]["Enums"]["scadenza_tipo"]
          titolo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scadenzario_voci_creditore_id_fkey"
            columns: ["creditore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenzario_voci_creditore_id_fkey"
            columns: ["creditore_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "scadenzario_voci_debitore_id_fkey"
            columns: ["debitore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenzario_voci_debitore_id_fkey"
            columns: ["debitore_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "scadenzario_voci_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenzario_voci_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "calendar_entries_for_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenzario_voci_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "scadenzario_voci_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
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
          {
            foreignKeyName: "service_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
          {
            foreignKeyName: "service_presets_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      services: {
        Row: {
          base_price: number
          category_id: string
          created_at: string
          description: string | null
          display_order: number
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
          display_order?: number
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
          display_order?: number
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
          {
            foreignKeyName: "services_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      servizio_template: {
        Row: {
          created_at: string
          descrizione: string | null
          id: string
          is_default_pack: boolean
          nome: string
          prezzo_base: number | null
          professione_id: string
          quantity_basis: string | null
          service_unit: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          descrizione?: string | null
          id?: string
          is_default_pack?: boolean
          nome: string
          prezzo_base?: number | null
          professione_id: string
          quantity_basis?: string | null
          service_unit?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          descrizione?: string | null
          id?: string
          is_default_pack?: boolean
          nome?: string
          prezzo_base?: number | null
          professione_id?: string
          quantity_basis?: string | null
          service_unit?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "servizio_template_professione_id_fkey"
            columns: ["professione_id"]
            isOneToOne: false
            referencedRelation: "professioni"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_contract_clauses: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          per_modalita: Database["public"]["Enums"]["modalita_incasso"] | null
          placeholders: string[]
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          per_modalita?: Database["public"]["Enums"]["modalita_incasso"] | null
          placeholders?: string[]
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          per_modalita?: Database["public"]["Enums"]["modalita_incasso"] | null
          placeholders?: string[]
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "supplier_availability_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
            foreignKeyName: "supplier_capostipite_pricing_capostipite_id_fkey"
            columns: ["capostipite_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
          {
            foreignKeyName: "supplier_capostipite_pricing_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      supplier_clients: {
        Row: {
          address: string | null
          budget_max: number | null
          budget_min: number | null
          business_name: string | null
          city: string | null
          country: string | null
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
          pec_email: string | null
          phone: string | null
          province: string | null
          sdi_code: string | null
          source: string | null
          status: string
          supplier_id: string
          tags: string[]
          updated_at: string
          vat_number: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          budget_max?: number | null
          budget_min?: number | null
          business_name?: string | null
          city?: string | null
          country?: string | null
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
          pec_email?: string | null
          phone?: string | null
          province?: string | null
          sdi_code?: string | null
          source?: string | null
          status?: string
          supplier_id: string
          tags?: string[]
          updated_at?: string
          vat_number?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          budget_max?: number | null
          budget_min?: number | null
          business_name?: string | null
          city?: string | null
          country?: string | null
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
          pec_email?: string | null
          phone?: string | null
          province?: string | null
          sdi_code?: string | null
          source?: string | null
          status?: string
          supplier_id?: string
          tags?: string[]
          updated_at?: string
          vat_number?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_clients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_clients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      supplier_contract_templates: {
        Row: {
          category: string | null
          created_at: string
          fornitore_id: string
          id: string
          is_default: boolean
          per_modalita: Database["public"]["Enums"]["modalita_incasso"]
          sections: Json
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          fornitore_id: string
          id?: string
          is_default?: boolean
          per_modalita?: Database["public"]["Enums"]["modalita_incasso"]
          sections?: Json
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          fornitore_id?: string
          id?: string
          is_default?: boolean
          per_modalita?: Database["public"]["Enums"]["modalita_incasso"]
          sections?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contract_templates_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_contract_templates_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
          target_role: string
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
          target_role?: string
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
          target_role?: string
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
          {
            foreignKeyName: "supplier_invites_capostipite_id_fkey"
            columns: ["capostipite_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
            foreignKeyName: "wedding_couple_members_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "wedding_couple_members_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "wedding_couple_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_couple_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
            foreignKeyName: "wedding_tasks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_riconciliazione_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "wedding_tasks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_salute_evento"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "wedding_tasks_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_tasks_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
            foreignKeyName: "calendar_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
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
          {
            foreignKeyName: "supplier_clients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      supplier_trial_status: {
        Row: {
          days_left: number | null
          state: string | null
          subscription_renews_at: string | null
          subscription_status: string | null
          supplier_id: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
        }
        Insert: {
          days_left?: never
          state?: never
          subscription_renews_at?: string | null
          subscription_status?: string | null
          supplier_id?: string | null
          trial_ends_at?: never
          trial_started_at?: string | null
        }
        Update: {
          days_left?: never
          state?: never
          subscription_renews_at?: string | null
          subscription_status?: string | null
          supplier_id?: string | null
          trial_ends_at?: never
          trial_started_at?: string | null
        }
        Relationships: []
      }
      user_rating_summary: {
        Row: {
          avg_stars: number | null
          ratings_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_ratings_rated_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_ratings_rated_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      v_notifiche_digest_per_utente: {
        Row: {
          data_digest: string | null
          destinatario_id: string | null
          primi_10: Json | null
          totale: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notifiche_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiche_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "supplier_trial_status"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      v_riconciliazione_evento: {
        Row: {
          count_menu_for_guest: number | null
          delta: number | null
          entry_id: string | null
          importo_menu_per_guest: number | null
          importo_totale_quote: number | null
          totale_ospiti_pending: number | null
          totale_ospiti_yes: number | null
        }
        Relationships: []
      }
      v_salute_evento: {
        Row: {
          blocchi_aperti_count: number | null
          entry_id: string | null
          evento_stato: Database["public"]["Enums"]["evento_stato"] | null
          giorni_alla_data: number | null
          salute_label: string | null
          ultimo_audit_il: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _quote_storage_paths: {
        Args: { p_quote_id: string }
        Returns: {
          bucket: string
          path: string
        }[]
      }
      _wedding_storage_paths: {
        Args: { p_entry_id: string }
        Returns: {
          bucket: string
          path: string
        }[]
      }
      accept_supplier_invite: { Args: { p_token: string }; Returns: boolean }
      admin_purge_deletion_requests: { Args: never; Returns: number }
      annulla_evento: {
        Args: { p_entry_id: string; p_motivo: string }
        Returns: Json
      }
      approve_candidacy: { Args: { p_follower: string }; Returns: boolean }
      approve_follow: { Args: { p_follower: string }; Returns: boolean }
      blog_get_by_slug: { Args: { p_slug: string }; Returns: Json }
      blog_list_published: {
        Args: {
          p_category?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          author_business: string
          author_city: string
          author_id: string
          author_logo: string
          author_name: string
          author_slug: string
          category_name: string
          category_slug: string
          excerpt: string
          hero_image_url: string
          id: string
          published_at: string
          reading_minutes: number
          slug: string
          tags: string[]
          title: string
          view_count: number
        }[]
      }
      build_contract_sections: { Args: { p_quote_id: string }; Returns: Json }
      calcola_markup_effettivo: {
        Args: {
          p_item_markup: number
          p_quote_id: string
          p_supplier_id: string
        }
        Returns: number
      }
      can_see_network_of: {
        Args: { p_author: string; p_viewer: string }
        Returns: boolean
      }
      capostipite_add_supplier: {
        Args: { p_supplier_id: string }
        Returns: Json
      }
      check_owner_date_busy: { Args: { p_date: string }; Returns: Json }
      check_supplier_available: {
        Args: { p_date: string; p_supplier: string }
        Returns: boolean
      }
      check_suppliers_busy_in_range: {
        Args: {
          p_date_from: string
          p_date_to: string
          p_supplier_ids: string[]
        }
        Returns: {
          conflict_date: string
          fornitore_id: string
          notes: string
          status: string
          supplier_business_name: string
          supplier_full_name: string
        }[]
      }
      claim_supplier_invite: { Args: { p_token: string }; Returns: boolean }
      cleanup_lead_attempts: { Args: never; Returns: undefined }
      contract_get_by_token: { Args: { p_token: string }; Returns: Json }
      contract_sign_by_token: {
        Args: {
          p_signer_fiscal: string
          p_signer_name: string
          p_token: string
        }
        Returns: boolean
      }
      countersign_contract: {
        Args: {
          p_contract_id: string
          p_signer_fiscal: string
          p_signer_name: string
        }
        Returns: {
          access_token: string | null
          access_token_expires_at: string | null
          client_address: string | null
          client_business_name: string | null
          client_city: string | null
          client_country: string | null
          client_email: string | null
          client_fiscal_code: string | null
          client_name: string | null
          client_pec_email: string | null
          client_province: string | null
          client_sdi_code: string | null
          client_vat_number: string | null
          client_zip: string | null
          countersign_at: string | null
          countersign_data: Json | null
          created_at: string
          direct_client_id: string | null
          entry_id: string | null
          event_date: string | null
          event_kind: string
          id: string
          owner_id: string
          party_kind: Database["public"]["Enums"]["contract_party_kind"]
          pdf_url: string | null
          quote_id: string | null
          sections: Json
          signature_data: Json | null
          signed_at: string | null
          signed_offline: boolean
          signed_offline_at: string | null
          signed_offline_notes: string | null
          signed_offline_pdf_url: string | null
          signed_offline_signer_name: string | null
          status: Database["public"]["Enums"]["contract_status"]
          supplier_id: string | null
          template_id: string | null
          title: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      couple_accept_invite: { Args: { p_token: string }; Returns: boolean }
      couple_get_quote_for_entry: {
        Args: { p_entry_id: string }
        Returns: Json
      }
      couple_save_planning: {
        Args: {
          p_additional_notes: string
          p_already_booked: Json
          p_entry_id: string
          p_planning_stage: string
          p_urgency: string
        }
        Returns: {
          additional_notes: string | null
          already_booked: Json
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
          planning_stage:
            | Database["public"]["Enums"]["couple_planning_stage"]
            | null
          preferred_palette: string[] | null
          preferred_season: string | null
          questionnaire_completed_at: string | null
          styles: Database["public"]["Enums"]["wedding_style"][] | null
          updated_at: string
          urgency: Database["public"]["Enums"]["couple_urgency"] | null
          vision_note: string | null
        }
        SetofOptions: {
          from: "*"
          to: "couple_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_contract_from_clauses: {
        Args: {
          p_entry_id: string
          p_party_kind: string
          p_sections: Json
          p_supplier_id?: string
          p_title: string
        }
        Returns: {
          access_token: string | null
          access_token_expires_at: string | null
          client_address: string | null
          client_business_name: string | null
          client_city: string | null
          client_country: string | null
          client_email: string | null
          client_fiscal_code: string | null
          client_name: string | null
          client_pec_email: string | null
          client_province: string | null
          client_sdi_code: string | null
          client_vat_number: string | null
          client_zip: string | null
          countersign_at: string | null
          countersign_data: Json | null
          created_at: string
          direct_client_id: string | null
          entry_id: string | null
          event_date: string | null
          event_kind: string
          id: string
          owner_id: string
          party_kind: Database["public"]["Enums"]["contract_party_kind"]
          pdf_url: string | null
          quote_id: string | null
          sections: Json
          signature_data: Json | null
          signed_at: string | null
          signed_offline: boolean
          signed_offline_at: string | null
          signed_offline_notes: string | null
          signed_offline_pdf_url: string | null
          signed_offline_signer_name: string | null
          status: Database["public"]["Enums"]["contract_status"]
          supplier_id: string | null
          template_id: string | null
          title: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_supplier_contract: {
        Args: {
          p_entry_id: string
          p_party_kind: string
          p_supplier_id: string
          p_template_id?: string
          p_title?: string
        }
        Returns: {
          access_token: string | null
          access_token_expires_at: string | null
          client_address: string | null
          client_business_name: string | null
          client_city: string | null
          client_country: string | null
          client_email: string | null
          client_fiscal_code: string | null
          client_name: string | null
          client_pec_email: string | null
          client_province: string | null
          client_sdi_code: string | null
          client_vat_number: string | null
          client_zip: string | null
          countersign_at: string | null
          countersign_data: Json | null
          created_at: string
          direct_client_id: string | null
          entry_id: string | null
          event_date: string | null
          event_kind: string
          id: string
          owner_id: string
          party_kind: Database["public"]["Enums"]["contract_party_kind"]
          pdf_url: string | null
          quote_id: string | null
          sections: Json
          signature_data: Json | null
          signed_at: string | null
          signed_offline: boolean
          signed_offline_at: string | null
          signed_offline_notes: string | null
          signed_offline_pdf_url: string | null
          signed_offline_signer_name: string | null
          status: Database["public"]["Enums"]["contract_status"]
          supplier_id: string | null
          template_id: string | null
          title: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_quote_cascade: {
        Args: { p_quote_id: string }
        Returns: {
          bucket: string
          path: string
        }[]
      }
      delete_wedding_cascade: {
        Args: { p_entry_id: string }
        Returns: {
          bucket: string
          path: string
        }[]
      }
      discover_suppliers: {
        Args: {
          p_city?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_subrole?: string
        }
        Returns: {
          bio: string
          brand_logo_url: string
          business_name: string
          city: string
          created_at: string
          discover_tier: string
          full_name: string
          id: string
          in_pancia_count: number
          province: string
          service_radius_km: number
          services_count: number
          slug: string
          subrole: string
          tagline: string
        }[]
      }
      discover_wp_and_locations: {
        Args: {
          p_city?: string
          p_limit?: number
          p_offset?: number
          p_role?: string
          p_search?: string
        }
        Returns: {
          bio: string
          brand_logo_url: string
          business_name: string
          city: string
          created_at: string
          full_name: string
          id: string
          posts_count: number
          province: string
          role: Database["public"]["Enums"]["user_role"]
          service_radius_km: number
          slug: string
          suppliers_count: number
          tagline: string
        }[]
      }
      dropout_fornitore: {
        Args: { p_motivo: string; p_quote_item_id: string }
        Returns: Json
      }
      feed_discover_trending: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          author_business: string
          author_id: string
          author_logo: string
          author_name: string
          author_role: Database["public"]["Enums"]["user_role"]
          author_slug: string
          author_subrole: string
          body: string
          body_html: string
          comment_count: number
          cover_image_url: string
          created_at: string
          event_id: string
          event_title: string
          id: string
          like_count: number
          liked_by_me: boolean
          link_preview: Json
          link_url: string
          media_urls: string[]
          post_type: string
          slug: string
          tagged_supplier_ids: string[]
          title: string
          trending_score: number
          visibility: string
        }[]
      }
      feed_home: {
        Args: { p_filter?: string; p_limit?: number; p_offset?: number }
        Returns: {
          author_business: string
          author_id: string
          author_logo: string
          author_name: string
          author_role: Database["public"]["Enums"]["user_role"]
          author_slug: string
          author_subrole: string
          body: string
          comment_count: number
          created_at: string
          event_id: string
          event_title: string
          id: string
          like_count: number
          liked_by_me: boolean
          media_urls: string[]
          tagged_supplier_ids: string[]
          visibility: string
        }[]
      }
      follow_stats: { Args: { p_user_id: string }; Returns: Json }
      gen_referral_code: { Args: never; Returns: string }
      get_feed_article_by_slug: { Args: { p_slug: string }; Returns: Json }
      get_referral_tier: { Args: { p_referrer_id: string }; Returns: Json }
      get_supplier_public_profile: { Args: { p_slug: string }; Returns: Json }
      get_wp_public_profile: { Args: { p_slug: string }; Returns: Json }
      has_active_collab_with_supplier: {
        Args: { p_supplier: string }
        Returns: boolean
      }
      invia_digest_giornaliero: { Args: never; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_collab_supplier_of_entry: {
        Args: { p_entry: string }
        Returns: boolean
      }
      is_entry_participant: { Args: { p_entry: string }; Returns: boolean }
      is_evento_member: { Args: { p_entry: string }; Returns: boolean }
      is_quote_owner: { Args: { p_quote: string }; Returns: boolean }
      is_service_owner: { Args: { p_service_id: string }; Returns: boolean }
      is_token_valid: { Args: { p_expires_at: string }; Returns: boolean }
      is_wedding_couple: { Args: { p_entry: string }; Returns: boolean }
      lead_transition: {
        Args: {
          p_close_amount?: number
          p_close_notes?: string
          p_lead_id: string
          p_new_status: string
        }
        Returns: Json
      }
      list_contracts_for_entry: {
        Args: { p_entry_id: string }
        Returns: {
          access_token: string
          client_name: string
          countersign_at: string
          id: string
          party_kind: string
          signed_at: string
          status: string
          supplier_id: string
          supplier_name: string
          title: string
          total_amount: number
        }[]
      }
      list_standard_clauses: {
        Args: never
        Returns: {
          body: string
          category: string
          id: string
          is_default: boolean
          per_modalita: string
          placeholders: string[]
          slug: string
          sort_order: number
          title: string
        }[]
      }
      list_supplier_contracts: {
        Args: never
        Returns: {
          access_token: string
          client_name: string
          countersign_at: string
          created_at: string
          entry_id: string
          entry_title: string
          event_date: string
          id: string
          party_kind: string
          signed_at: string
          status: string
          title: string
          total_amount: number
        }[]
      }
      list_user_reviews: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          created_at: string
          entry_title: string
          id: string
          rater_id: string
          rater_logo: string
          rater_name: string
          rater_role: string
          rater_slug: string
          review: string
          stars: number
        }[]
      }
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
      my_referral_stats: { Args: never; Returns: Json }
      notifiche_genera_promemoria_per_evento: {
        Args: { p_entry_id: string }
        Returns: number
      }
      owner_finance_stats: { Args: { p_owner_id?: string }; Returns: Json }
      pending_candidacies: {
        Args: never
        Returns: {
          brand_logo_url: string
          business_name: string
          city: string
          follower_id: string
          follower_role: string
          full_name: string
          requested_at: string
          slug: string
          subrole: string
        }[]
      }
      post_comments_list: {
        Args: { p_post_id: string }
        Returns: {
          author_business: string
          author_id: string
          author_logo: string
          author_name: string
          author_role: Database["public"]["Enums"]["user_role"]
          author_slug: string
          body: string
          created_at: string
          id: string
        }[]
      }
      post_toggle_like: { Args: { p_post_id: string }; Returns: Json }
      quote_accept_by_token: { Args: { p_token: string }; Returns: boolean }
      quote_get_by_token: { Args: { p_token: string }; Returns: Json }
      quote_pick_alternative: {
        Args: { p_item_id: string; p_token: string }
        Returns: boolean
      }
      quote_promote_to_inviato: {
        Args: { p_quote_id: string }
        Returns: undefined
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
      rate_user: {
        Args: {
          p_entry: string
          p_rated: string
          p_review?: string
          p_stars: number
        }
        Returns: {
          created_at: string
          entry_id: string | null
          id: string
          rated_id: string
          rater_id: string
          review: string | null
          stars: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "collaboration_ratings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rateable_users_for_entry: {
        Args: { p_entry: string }
        Returns: {
          display_name: string
          role: string
          user_id: string
        }[]
      }
      referral_redeem_code: { Args: { p_code: string }; Returns: Json }
      refresh_notifiche_per_evento: {
        Args: { p_entry_id: string }
        Returns: undefined
      }
      reject_candidacy: { Args: { p_follower: string }; Returns: boolean }
      reject_follow: { Args: { p_follower: string }; Returns: boolean }
      reorder_services: { Args: { p_ids: string[] }; Returns: undefined }
      request_account_deletion: { Args: never; Returns: boolean }
      request_follow: {
        Args: { p_target: string }
        Returns: {
          created_at: string
          decided_at: string | null
          followed_id: string
          follower_id: string
          status: Database["public"]["Enums"]["follow_status"]
        }
        SetofOptions: {
          from: "*"
          to: "follows"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_capostipite_invite: { Args: { p_token: string }; Returns: Json }
      resolve_couple_invite: { Args: { p_token: string }; Returns: Json }
      resolve_supplier_invite: { Args: { p_token: string }; Returns: Json }
      riconciliazione_allinea_menu: {
        Args: { p_entry_id: string }
        Returns: Json
      }
      riprogramma_evento: {
        Args: { p_entry_id: string; p_nuova_data: string }
        Returns: Json
      }
      save_quote_inspirations: {
        Args: { p_inspirations: Json; p_token: string }
        Returns: Json
      }
      search_suppliers_for_tag: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          brand_logo_url: string
          business_name: string
          full_name: string
          id: string
          subrole: string
        }[]
      }
      seed_user: {
        Args: {
          p_email: string
          p_id: string
          p_meta: Json
          p_password: string
        }
        Returns: undefined
      }
      sign_contract_offline: {
        Args: {
          p_contract_id: string
          p_notes?: string
          p_pdf_url?: string
          p_signer_fiscal?: string
          p_signer_name: string
        }
        Returns: Json
      }
      slugify: { Args: { p_text: string }; Returns: string }
      submit_lead_request: {
        Args: {
          p_budget_range?: string
          p_client_email: string
          p_client_name: string
          p_client_phone?: string
          p_event_date?: string
          p_event_kind?: string
          p_event_location?: string
          p_guests_estimate?: number
          p_honeypot?: string
          p_message?: string
          p_source?: string
          p_wp_slug: string
        }
        Returns: Json
      }
      supplier_confirm_quote_item: {
        Args: { p_item_id: string }
        Returns: {
          alternative_group: string | null
          client_selected_at: string | null
          created_at: string
          description_snapshot: string | null
          erogatore_e_capostipite: boolean
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
          supplier_confirmed_at: string | null
          supplier_confirmed_by: string | null
          supplier_id: string | null
          unit_snapshot: Database["public"]["Enums"]["service_unit"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "quote_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      supplier_invite_capostipite: { Args: { p_email: string }; Returns: Json }
      supplier_request_collaboration: {
        Args: { p_capostipite_id: string; p_message?: string }
        Returns: Json
      }
      supplier_view_couple_minimal: {
        Args: { p_entry: string }
        Returns: {
          contact_email: string
          couple_name: string
          date_from: string
          location_short: string
          related_items: Json
        }[]
      }
      toggle_follow: { Args: { p_followed_id: string }; Returns: Json }
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
      wp_invite_capostipite: {
        Args: {
          p_email: string
          p_message?: string
          p_subrole_hint?: string
          p_target_role?: string
        }
        Returns: {
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
          target_role: string
          token: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "supplier_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wp_lead_stats: { Args: never; Returns: Json }
    }
    Enums: {
      accommodation_kind:
        | "HOTEL"
        | "BNB"
        | "AIRBNB"
        | "VILLA_PRIVATA"
        | "APPARTAMENTO"
        | "RESORT"
      ambito_capostipite:
        | "COMPLETO"
        | "SOLO_COORDINAMENTO"
        | "SOLO_PROPRI_SERVIZI"
      ceremony_status:
        | "TO_DEFINE"
        | "EVALUATING"
        | "REQUESTED"
        | "BOOKED"
        | "CANCELLED"
      ceremony_type:
        | "RELIGIOUS"
        | "CIVIL"
        | "SYMBOLIC"
        | "ELOPEMENT"
        | "MIXED"
        | "OTHER"
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
      collaboration_status:
        | "PENDING"
        | "ACTIVE"
        | "REVOKED"
        | "PENDING_FROM_SUPPLIER"
      contract_party_kind: "CLIENT_WP" | "SUPPLIER_WP" | "SUPPLIER_CLIENT"
      contract_status: "BOZZA" | "INVIATO" | "FIRMATO" | "ANNULLATO"
      couple_planning_stage:
        | "JUST_ENGAGED"
        | "EXPLORING"
        | "COMPARING"
        | "MOSTLY_BOOKED"
        | "FINAL_DETAILS"
      couple_role: "SPOSO" | "SPOSA" | "PARTNER" | "PERSONA_DI_FIDUCIA"
      couple_urgency: "RELAXED" | "NORMAL" | "TIGHT" | "URGENT"
      entry_status:
        | "IN_TRATTATIVA"
        | "OPZIONATA"
        | "CONFERMATA"
        | "RIFIUTATA"
        | "CANCELLATA"
      evento_cambiamento_stato: "IN_CORSO" | "COMPLETATO" | "FALLITO"
      evento_cambiamento_tipo:
        | "RIPROGRAMMA"
        | "DROPOUT_FORNITORE"
        | "ANNULLAMENTO"
      evento_stato:
        | "LEAD"
        | "INCARICO_FIRMATO"
        | "PREVENTIVI"
        | "PREVENTIVO_FIRMATO"
        | "CONTRATTO"
        | "PIANIFICAZIONE"
        | "CHECKLIST"
        | "SVOLTO"
        | "ANNULLATO"
      follow_status: "PENDING" | "APPROVED" | "REJECTED"
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
      guest_age_group: "ADULT" | "CHILD" | "INFANT"
      legal_form:
        | "INDIVIDUAL"
        | "SRL"
        | "SRLS"
        | "SPA"
        | "SAS"
        | "SNC"
        | "COOPERATIVE"
        | "ASSOCIATION"
        | "OTHER"
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
      modalita_incasso: "INTERO" | "SEGNALAZIONE"
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
      scadenza_tipo: "ACCONTO" | "SALDO" | "RATA" | "PENALE" | "RIMBORSO"
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
      ambito_capostipite: [
        "COMPLETO",
        "SOLO_COORDINAMENTO",
        "SOLO_PROPRI_SERVIZI",
      ],
      ceremony_status: [
        "TO_DEFINE",
        "EVALUATING",
        "REQUESTED",
        "BOOKED",
        "CANCELLED",
      ],
      ceremony_type: [
        "RELIGIOUS",
        "CIVIL",
        "SYMBOLIC",
        "ELOPEMENT",
        "MIXED",
        "OTHER",
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
      collaboration_status: [
        "PENDING",
        "ACTIVE",
        "REVOKED",
        "PENDING_FROM_SUPPLIER",
      ],
      contract_party_kind: ["CLIENT_WP", "SUPPLIER_WP", "SUPPLIER_CLIENT"],
      contract_status: ["BOZZA", "INVIATO", "FIRMATO", "ANNULLATO"],
      couple_planning_stage: [
        "JUST_ENGAGED",
        "EXPLORING",
        "COMPARING",
        "MOSTLY_BOOKED",
        "FINAL_DETAILS",
      ],
      couple_role: ["SPOSO", "SPOSA", "PARTNER", "PERSONA_DI_FIDUCIA"],
      couple_urgency: ["RELAXED", "NORMAL", "TIGHT", "URGENT"],
      entry_status: [
        "IN_TRATTATIVA",
        "OPZIONATA",
        "CONFERMATA",
        "RIFIUTATA",
        "CANCELLATA",
      ],
      evento_cambiamento_stato: ["IN_CORSO", "COMPLETATO", "FALLITO"],
      evento_cambiamento_tipo: [
        "RIPROGRAMMA",
        "DROPOUT_FORNITORE",
        "ANNULLAMENTO",
      ],
      evento_stato: [
        "LEAD",
        "INCARICO_FIRMATO",
        "PREVENTIVI",
        "PREVENTIVO_FIRMATO",
        "CONTRATTO",
        "PIANIFICAZIONE",
        "CHECKLIST",
        "SVOLTO",
        "ANNULLATO",
      ],
      follow_status: ["PENDING", "APPROVED", "REJECTED"],
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
      guest_age_group: ["ADULT", "CHILD", "INFANT"],
      legal_form: [
        "INDIVIDUAL",
        "SRL",
        "SRLS",
        "SPA",
        "SAS",
        "SNC",
        "COOPERATIVE",
        "ASSOCIATION",
        "OTHER",
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
      modalita_incasso: ["INTERO", "SEGNALAZIONE"],
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
      scadenza_tipo: ["ACCONTO", "SALDO", "RATA", "PENALE", "RIMBORSO"],
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

