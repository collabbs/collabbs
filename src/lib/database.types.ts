// Types générés depuis le schéma Supabase (24 tables).
// Régénérer après chaque migration via le MCP Supabase (generate_typescript_types)
// ou : npx supabase gen types typescript --project-id muuyrrvetwegkrmpkkad

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      affiliate_events: {
        Row: {
          commission_amount: number | null
          created_at: string
          external_ref: string | null
          id: string
          link_id: string
          occurred_at: string
          sale_amount: number | null
          type: Database["public"]["Enums"]["affiliate_event_type"]
        }
        Insert: {
          commission_amount?: number | null
          created_at?: string
          external_ref?: string | null
          id?: string
          link_id: string
          occurred_at?: string
          sale_amount?: number | null
          type: Database["public"]["Enums"]["affiliate_event_type"]
        }
        Update: {
          commission_amount?: number | null
          created_at?: string
          external_ref?: string | null
          id?: string
          link_id?: string
          occurred_at?: string
          sale_amount?: number | null
          type?: Database["public"]["Enums"]["affiliate_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_events_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_links: {
        Row: {
          campaign_id: string
          code: string
          created_at: string
          creator_id: string
          id: string
        }
        Insert: {
          campaign_id: string
          code: string
          created_at?: string
          creator_id: string
          id?: string
        }
        Update: {
          campaign_id?: string
          code?: string
          created_at?: string
          creator_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          campaign_id: string
          created_at: string
          creator_id: string
          id: string
          initiated_by: Database["public"]["Enums"]["application_initiator"]
          message: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          creator_id: string
          id?: string
          initiated_by: Database["public"]["Enums"]["application_initiator"]
          message?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          initiated_by?: Database["public"]["Enums"]["application_initiator"]
          message?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_creator_saves: {
        Row: {
          brand_id: string
          created_at: string
          creator_id: string
          notes: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          creator_id: string
          notes?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          creator_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_creator_saves_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_creator_saves_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_niches: {
        Row: {
          brand_id: string
          niche_id: number
        }
        Insert: {
          brand_id: string
          niche_id: number
        }
        Update: {
          brand_id?: string
          niche_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "brand_niches_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_niches_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_platforms: {
        Row: {
          brand_id: string
          handle: string | null
          platform_id: number
          url: string | null
        }
        Insert: {
          brand_id: string
          handle?: string | null
          platform_id: number
          url?: string | null
        }
        Update: {
          brand_id?: string
          handle?: string | null
          platform_id?: number
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_platforms_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_platforms_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          commission_macro: number
          commission_micro: number
          commission_mid: number
          commission_nano: number
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          postback_secret: string
          sector: string | null
          tracking_verified_at: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          commission_macro?: number
          commission_micro?: number
          commission_mid?: number
          commission_nano?: number
          created_at?: string
          description?: string | null
          id: string
          logo_url?: string | null
          name: string
          postback_secret?: string
          sector?: string | null
          tracking_verified_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          commission_macro?: number
          commission_micro?: number
          commission_mid?: number
          commission_nano?: number
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          postback_secret?: string
          sector?: string | null
          tracking_verified_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_niches: {
        Row: {
          campaign_id: string
          niche_id: number
        }
        Insert: {
          campaign_id: string
          niche_id: number
        }
        Update: {
          campaign_id?: string
          niche_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_niches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_niches_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_platforms: {
        Row: {
          campaign_id: string
          platform_id: number
        }
        Insert: {
          campaign_id: string
          platform_id: number
        }
        Update: {
          campaign_id?: string
          platform_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_platforms_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_platforms_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          avoid: string | null
          brand_id: string
          category: string | null
          commission_macro: number | null
          commission_micro: number | null
          commission_mid: number | null
          commission_nano: number | null
          commission_type: Database["public"]["Enums"]["commission_type"] | null
          commission_unit: string | null
          commission_value: number | null
          created_at: string
          description: string | null
          ends_at: string | null
          fixed_amount: number | null
          id: string
          min_subscribers: number | null
          name: string
          requirements: string | null
          spots: number | null
          starts_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          target_url: string | null
          tone: Database["public"]["Enums"]["content_tone"] | null
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at: string
        }
        Insert: {
          avoid?: string | null
          brand_id: string
          category?: string | null
          commission_macro?: number | null
          commission_micro?: number | null
          commission_mid?: number | null
          commission_nano?: number | null
          commission_type?: Database["public"]["Enums"]["commission_type"] | null
          commission_unit?: string | null
          commission_value?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          fixed_amount?: number | null
          id?: string
          min_subscribers?: number | null
          name: string
          requirements?: string | null
          spots?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_url?: string | null
          tone?: Database["public"]["Enums"]["content_tone"] | null
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Update: {
          avoid?: string | null
          brand_id?: string
          category?: string | null
          commission_macro?: number | null
          commission_micro?: number | null
          commission_mid?: number | null
          commission_nano?: number | null
          commission_type?: Database["public"]["Enums"]["commission_type"] | null
          commission_unit?: string | null
          commission_value?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          fixed_amount?: number | null
          id?: string
          min_subscribers?: number | null
          name?: string
          requirements?: string | null
          spots?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_url?: string | null
          tone?: Database["public"]["Enums"]["content_tone"] | null
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          brand_signed_at: string | null
          created_at: string
          creator_signed_at: string | null
          deal_id: string
          id: string
          reference: string
          status: Database["public"]["Enums"]["contract_status"]
          terminated_at: string | null
          terms_snapshot: Json | null
          updated_at: string
        }
        Insert: {
          brand_signed_at?: string | null
          created_at?: string
          creator_signed_at?: string | null
          deal_id: string
          id?: string
          reference: string
          status?: Database["public"]["Enums"]["contract_status"]
          terminated_at?: string | null
          terms_snapshot?: Json | null
          updated_at?: string
        }
        Update: {
          brand_signed_at?: string | null
          created_at?: string
          creator_signed_at?: string | null
          deal_id?: string
          id?: string
          reference?: string
          status?: Database["public"]["Enums"]["contract_status"]
          terminated_at?: string | null
          terms_snapshot?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          brand_id: string
          created_at: string
          creator_id: string
          id: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          creator_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_niches: {
        Row: {
          creator_id: string
          niche_id: number
        }
        Insert: {
          creator_id: string
          niche_id: number
        }
        Update: {
          creator_id?: string
          niche_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_niches_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_niches_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_offers: {
        Row: {
          created_at: string
          creator_id: string
          offer: Database["public"]["Enums"]["offer_type"]
          price: number | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          offer: Database["public"]["Enums"]["offer_type"]
          price?: number | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          offer?: Database["public"]["Enums"]["offer_type"]
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_offers_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_platforms: {
        Row: {
          creator_id: string
          handle: string | null
          id: string
          platform_id: number
          subscribers: number | null
          url: string | null
        }
        Insert: {
          creator_id: string
          handle?: string | null
          id?: string
          platform_id: number
          subscribers?: number | null
          url?: string | null
        }
        Update: {
          creator_id?: string
          handle?: string | null
          id?: string
          platform_id?: number
          subscribers?: number | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_platforms_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_platforms_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          bio: string | null
          created_at: string
          custom_niche: string | null
          deals_count: number
          engagement: number | null
          handle: string | null
          id: string
          is_demo: boolean
          rate_mention: number | null
          rate_pack: number | null
          rate_video: number | null
          rating: number | null
          reliability_score: number | null
          reviews_count: number
          stripe_account_id: string | null
          total_earnings: number
          updated_at: string
          verified: boolean
        }
        Insert: {
          bio?: string | null
          created_at?: string
          custom_niche?: string | null
          deals_count?: number
          engagement?: number | null
          handle?: string | null
          id: string
          is_demo?: boolean
          rate_mention?: number | null
          rate_pack?: number | null
          rate_video?: number | null
          rating?: number | null
          reliability_score?: number | null
          reviews_count?: number
          stripe_account_id?: string | null
          total_earnings?: number
          updated_at?: string
          verified?: boolean
        }
        Update: {
          bio?: string | null
          created_at?: string
          custom_niche?: string | null
          deals_count?: number
          engagement?: number | null
          handle?: string | null
          id?: string
          is_demo?: boolean
          rate_mention?: number | null
          rate_pack?: number | null
          rate_video?: number | null
          rating?: number | null
          reliability_score?: number | null
          reviews_count?: number
          stripe_account_id?: string | null
          total_earnings?: number
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "creators_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          accepted_at: string | null
          amount: number
          brand_id: string
          brand_notes: string | null
          brand_validated_at: string | null
          brand_validation_deadline_days: number
          campaign_id: string | null
          created_at: string
          creator_id: string
          deadline: string | null
          escrow_due_at: string | null
          exclusivity: boolean
          exclusivity_days: number | null
          format: Database["public"]["Enums"]["deal_format"]
          id: string
          platform_id: number | null
          quantity: number
          revision_rounds_max: number
          revision_rounds_used: number
          status: Database["public"]["Enums"]["deal_status"]
          title: string | null
          updated_at: string
          usage_rights_months: number | null
        }
        Insert: {
          accepted_at?: string | null
          amount: number
          brand_id: string
          brand_notes?: string | null
          brand_validated_at?: string | null
          brand_validation_deadline_days?: number
          campaign_id?: string | null
          created_at?: string
          creator_id: string
          deadline?: string | null
          escrow_due_at?: string | null
          exclusivity?: boolean
          exclusivity_days?: number | null
          format: Database["public"]["Enums"]["deal_format"]
          id?: string
          platform_id?: number | null
          quantity?: number
          revision_rounds_max?: number
          revision_rounds_used?: number
          status?: Database["public"]["Enums"]["deal_status"]
          title?: string | null
          updated_at?: string
          usage_rights_months?: number | null
        }
        Update: {
          accepted_at?: string | null
          amount?: number
          brand_id?: string
          brand_notes?: string | null
          brand_validated_at?: string | null
          brand_validation_deadline_days?: number
          campaign_id?: string | null
          created_at?: string
          creator_id?: string
          deadline?: string | null
          escrow_due_at?: string | null
          exclusivity?: boolean
          exclusivity_days?: number | null
          format?: Database["public"]["Enums"]["deal_format"]
          id?: string
          platform_id?: number | null
          quantity?: number
          revision_rounds_max?: number
          revision_rounds_used?: number
          status?: Database["public"]["Enums"]["deal_status"]
          title?: string | null
          updated_at?: string
          usage_rights_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          approved: boolean
          created_at: string
          deal_id: string
          done: boolean
          id: string
          label: string
          position: number
          revision_message: string | null
          revision_requested: boolean
          submission_files: Json
          submission_notes: string | null
          submission_url: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          deal_id: string
          done?: boolean
          id?: string
          label: string
          position?: number
          revision_message?: string | null
          revision_requested?: boolean
          submission_files?: Json
          submission_notes?: string | null
          submission_url?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          deal_id?: string
          done?: boolean
          id?: string
          label?: string
          position?: number
          revision_message?: string | null
          revision_requested?: boolean
          submission_files?: Json
          submission_notes?: string | null
          submission_url?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_info: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          country: string | null
          created_at: string
          legal_name: string | null
          rep_name: string | null
          siret: string | null
          status: string | null
          updated_at: string
          user_id: string
          vat: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string
          legal_name?: string | null
          rep_name?: string | null
          siret?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          vat?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string
          legal_name?: string | null
          rep_name?: string | null
          siret?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          vat?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_info_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      niches: {
        Row: {
          id: number
          label: string
          slug: string
        }
        Insert: {
          id?: never
          label: string
          slug: string
        }
        Update: {
          id?: never
          label?: string
          slug?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platforms: {
        Row: {
          id: number
          label: string
          slug: string
        }
        Insert: {
          id?: never
          label: string
          slug: string
        }
        Update: {
          id?: never
          label?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          brand_id: string
          comment: string | null
          created_at: string
          creator_id: string
          deal_id: string | null
          id: string
          rating: number
        }
        Insert: {
          brand_id: string
          comment?: string | null
          created_at?: string
          creator_id: string
          deal_id?: string | null
          id?: string
          rating: number
        }
        Update: {
          brand_id?: string
          comment?: string | null
          created_at?: string
          creator_id?: string
          deal_id?: string | null
          id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          brand_id: string | null
          created_at: string
          creator_id: string
          currency: string
          deal_id: string | null
          escrow_released_at: string | null
          gross_amount: number
          id: string
          net_amount: number
          paid_at: string | null
          platform_fee: number
          platform_fee_rate: number
          reference: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          deal_id?: string | null
          escrow_released_at?: string | null
          gross_amount: number
          id?: string
          net_amount: number
          paid_at?: string | null
          platform_fee?: number
          platform_fee_rate?: number
          reference?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          deal_id?: string | null
          escrow_released_at?: string | null
          gross_amount?: number
          id?: string
          net_amount?: number
          paid_at?: string | null
          platform_fee?: number
          platform_fee_rate?: number
          reference?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      affiliate_event_type: "click" | "sale"
      application_initiator: "creator" | "brand"
      application_status: "pending" | "accepted" | "rejected" | "withdrawn"
      campaign_status: "draft" | "active" | "ended"
      campaign_type: "affiliation" | "video" | "hybrid" | "performance"
      commission_type: "percentage" | "fixed_per_action" | "recurring"
      content_tone: "authentic" | "educational" | "testimonial"
      contract_status: "draft" | "pending_signature" | "signed" | "terminated"
      deal_format: "video_post" | "ugc" | "story" | "reel" | "live"
      deal_status: "negotiation" | "active" | "completed" | "cancelled"
      offer_type: "ugc" | "post" | "perf" | "affil" | "story"
      transaction_status:
        | "pending"
        | "in_escrow"
        | "released"
        | "paid"
        | "refunded"
        | "cancelled"
      transaction_type: "deal_payment" | "affiliate_payout"
      user_role: "creator" | "brand"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
