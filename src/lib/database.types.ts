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
      affiliate_clawbacks: {
        Row: {
          affiliate_event_id: string | null
          amount: number
          brand_id: string | null
          created_at: string
          creator_id: string
          id: string
          reason: string | null
          settled_at: string | null
          settled_by_tx: string | null
        }
        Insert: {
          affiliate_event_id?: string | null
          amount: number
          brand_id?: string | null
          created_at?: string
          creator_id: string
          id?: string
          reason?: string | null
          settled_at?: string | null
          settled_by_tx?: string | null
        }
        Update: {
          affiliate_event_id?: string | null
          amount?: number
          brand_id?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          reason?: string | null
          settled_at?: string | null
          settled_by_tx?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clawbacks_affiliate_event_id_fkey"
            columns: ["affiliate_event_id"]
            isOneToOne: false
            referencedRelation: "affiliate_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clawbacks_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clawbacks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clawbacks_settled_by_tx_fkey"
            columns: ["settled_by_tx"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_events: {
        Row: {
          action_count: number
          click_day: string | null
          commission_amount: number | null
          created_at: string
          external_ref: string | null
          id: string
          link_id: string
          needs_review: boolean
          occurred_at: string
          paid_at: string | null
          payout_id: string | null
          platform_fee: number
          refunded_at: string | null
          reject_reason: string | null
          reviewed_at: string | null
          sale_amount: number | null
          source: string
          status: Database["public"]["Enums"]["affiliate_event_status"] | null
          type: Database["public"]["Enums"]["affiliate_event_type"]
          validate_at: string | null
          visitor_hash: string | null
        }
        Insert: {
          action_count?: number
          click_day?: string | null
          commission_amount?: number | null
          created_at?: string
          external_ref?: string | null
          id?: string
          link_id: string
          needs_review?: boolean
          occurred_at?: string
          paid_at?: string | null
          payout_id?: string | null
          platform_fee?: number
          refunded_at?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          sale_amount?: number | null
          source?: string
          status?: Database["public"]["Enums"]["affiliate_event_status"] | null
          type: Database["public"]["Enums"]["affiliate_event_type"]
          validate_at?: string | null
          visitor_hash?: string | null
        }
        Update: {
          action_count?: number
          click_day?: string | null
          commission_amount?: number | null
          created_at?: string
          external_ref?: string | null
          id?: string
          link_id?: string
          needs_review?: boolean
          occurred_at?: string
          paid_at?: string | null
          payout_id?: string | null
          platform_fee?: number
          refunded_at?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          sale_amount?: number | null
          source?: string
          status?: Database["public"]["Enums"]["affiliate_event_status"] | null
          type?: Database["public"]["Enums"]["affiliate_event_type"]
          validate_at?: string | null
          visitor_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_events_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_events_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
          promo_code: string | null
        }
        Insert: {
          campaign_id: string
          code: string
          created_at?: string
          creator_id: string
          id?: string
          promo_code?: string | null
        }
        Update: {
          campaign_id?: string
          code?: string
          created_at?: string
          creator_id?: string
          id?: string
          promo_code?: string | null
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
      brand_ledger: {
        Row: {
          affiliate_event_id: string | null
          amount: number
          balance_after: number
          brand_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          label: string | null
          stripe_ref: string | null
          transaction_id: string | null
        }
        Insert: {
          affiliate_event_id?: string | null
          amount: number
          balance_after: number
          brand_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          label?: string | null
          stripe_ref?: string | null
          transaction_id?: string | null
        }
        Update: {
          affiliate_event_id?: string | null
          amount?: number
          balance_after?: number
          brand_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["ledger_kind"]
          label?: string | null
          stripe_ref?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_ledger_affiliate_event_id_fkey"
            columns: ["affiliate_event_id"]
            isOneToOne: false
            referencedRelation: "affiliate_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_ledger_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_ledger_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
      brand_reviews: {
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
            foreignKeyName: "brand_reviews_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_reviews_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_reviews_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          autotopup_amount: number
          autotopup_enabled: boolean
          autotopup_threshold: number
          balance: number
          commission_macro: number
          commission_micro: number
          commission_mid: number
          commission_nano: number
          created_at: string
          description: string | null
          id: string
          is_demo: boolean
          logo_url: string | null
          name: string
          payment_method_id: string | null
          postback_secret: string
          rating: number | null
          reviews_count: number
          sector: string | null
          stripe_customer_id: string | null
          topup_failed_at: string | null
          tracking_verified_at: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          autotopup_amount?: number
          autotopup_enabled?: boolean
          autotopup_threshold?: number
          balance?: number
          commission_macro?: number
          commission_micro?: number
          commission_mid?: number
          commission_nano?: number
          created_at?: string
          description?: string | null
          id: string
          is_demo?: boolean
          logo_url?: string | null
          name: string
          payment_method_id?: string | null
          postback_secret?: string
          rating?: number | null
          reviews_count?: number
          sector?: string | null
          stripe_customer_id?: string | null
          topup_failed_at?: string | null
          tracking_verified_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          autotopup_amount?: number
          autotopup_enabled?: boolean
          autotopup_threshold?: number
          balance?: number
          commission_macro?: number
          commission_micro?: number
          commission_mid?: number
          commission_nano?: number
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name?: string
          payment_method_id?: string | null
          postback_secret?: string
          rating?: number | null
          reviews_count?: number
          sector?: string | null
          stripe_customer_id?: string | null
          topup_failed_at?: string | null
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
      campaign_cpa_tiers: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          label: string | null
          min_actions: number
          payout: number
          position: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          label?: string | null
          min_actions: number
          payout: number
          position?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          label?: string | null
          min_actions?: number
          payout?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_cpa_tiers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_examples: {
        Row: {
          campaign_id: string
          caption: string | null
          created_at: string
          id: string
          position: number
          url: string | null
        }
        Insert: {
          campaign_id: string
          caption?: string | null
          created_at?: string
          id?: string
          position?: number
          url?: string | null
        }
        Update: {
          campaign_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          position?: number
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_examples_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
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
          attribution_days: number
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
          cpa_action_label: string | null
          cpa_value_per_action: number | null
          created_at: string
          description: string | null
          ends_at: string | null
          fixed_amount: number | null
          giveaway_prize_label: string | null
          giveaway_prize_value: number | null
          giveaway_rules_url: string | null
          giveaway_winners_count: number | null
          id: string
          min_subscribers: number | null
          name: string
          product_image_url: string | null
          product_kind: Database["public"]["Enums"]["product_kind"] | null
          product_name: string | null
          product_retail_value: number | null
          product_url: string | null
          promo_auto_generate: boolean
          promo_code: string | null
          promo_commission_pct: number | null
          promo_discount_pct: number | null
          promo_expires_at: string | null
          promo_min_purchase: number | null
          requirements: string | null
          ships_product_to_creator: boolean
          spots: number | null
          starts_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          target_url: string | null
          tone: Database["public"]["Enums"]["content_tone"] | null
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at: string
          with_giveaway: boolean
          with_promo_code: boolean
        }
        Insert: {
          attribution_days?: number
          avoid?: string | null
          brand_id: string
          category?: string | null
          commission_macro?: number | null
          commission_micro?: number | null
          commission_mid?: number | null
          commission_nano?: number | null
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_unit?: string | null
          commission_value?: number | null
          cpa_action_label?: string | null
          cpa_value_per_action?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          fixed_amount?: number | null
          giveaway_prize_label?: string | null
          giveaway_prize_value?: number | null
          giveaway_rules_url?: string | null
          giveaway_winners_count?: number | null
          id?: string
          min_subscribers?: number | null
          name: string
          product_image_url?: string | null
          product_kind?: Database["public"]["Enums"]["product_kind"] | null
          product_name?: string | null
          product_retail_value?: number | null
          product_url?: string | null
          promo_auto_generate?: boolean
          promo_code?: string | null
          promo_commission_pct?: number | null
          promo_discount_pct?: number | null
          promo_expires_at?: string | null
          promo_min_purchase?: number | null
          requirements?: string | null
          ships_product_to_creator?: boolean
          spots?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_url?: string | null
          tone?: Database["public"]["Enums"]["content_tone"] | null
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
          with_giveaway?: boolean
          with_promo_code?: boolean
        }
        Update: {
          attribution_days?: number
          avoid?: string | null
          brand_id?: string
          category?: string | null
          commission_macro?: number | null
          commission_micro?: number | null
          commission_mid?: number | null
          commission_nano?: number | null
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_unit?: string | null
          commission_value?: number | null
          cpa_action_label?: string | null
          cpa_value_per_action?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          fixed_amount?: number | null
          giveaway_prize_label?: string | null
          giveaway_prize_value?: number | null
          giveaway_rules_url?: string | null
          giveaway_winners_count?: number | null
          id?: string
          min_subscribers?: number | null
          name?: string
          product_image_url?: string | null
          product_kind?: Database["public"]["Enums"]["product_kind"] | null
          product_name?: string | null
          product_retail_value?: number | null
          product_url?: string | null
          promo_auto_generate?: boolean
          promo_code?: string | null
          promo_commission_pct?: number | null
          promo_discount_pct?: number | null
          promo_expires_at?: string | null
          promo_min_purchase?: number | null
          requirements?: string | null
          ships_product_to_creator?: boolean
          spots?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_url?: string | null
          tone?: Database["public"]["Enums"]["content_tone"] | null
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
          with_giveaway?: boolean
          with_promo_code?: boolean
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
          brand_id: string | null
          brand_signed_at: string | null
          created_at: string
          creator_id: string | null
          creator_signed_at: string | null
          deal_id: string | null
          id: string
          kind: string
          period_year: number | null
          reference: string
          status: Database["public"]["Enums"]["contract_status"]
          terminated_at: string | null
          terms_snapshot: Json | null
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          brand_signed_at?: string | null
          created_at?: string
          creator_id?: string | null
          creator_signed_at?: string | null
          deal_id?: string | null
          id?: string
          kind?: string
          period_year?: number | null
          reference: string
          status?: Database["public"]["Enums"]["contract_status"]
          terminated_at?: string | null
          terms_snapshot?: Json | null
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          brand_signed_at?: string | null
          created_at?: string
          creator_id?: string | null
          creator_signed_at?: string | null
          deal_id?: string | null
          id?: string
          kind?: string
          period_year?: number | null
          reference?: string
          status?: Database["public"]["Enums"]["contract_status"]
          terminated_at?: string | null
          terms_snapshot?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          platform_ref: string | null
          subscribers: number | null
          url: string | null
          verified_at: string | null
          verified_source: string | null
          verified_subscribers: number | null
        }
        Insert: {
          creator_id: string
          handle?: string | null
          id?: string
          platform_id: number
          platform_ref?: string | null
          subscribers?: number | null
          url?: string | null
          verified_at?: string | null
          verified_source?: string | null
          verified_subscribers?: number | null
        }
        Update: {
          creator_id?: string
          handle?: string | null
          id?: string
          platform_id?: number
          platform_ref?: string | null
          subscribers?: number | null
          url?: string | null
          verified_at?: string | null
          verified_source?: string | null
          verified_subscribers?: number | null
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
      creator_portfolio_items: {
        Row: {
          created_at: string
          creator_id: string
          duration_seconds: number | null
          id: string
          is_short: boolean
          like_count: number | null
          platform_slug: string | null
          position: number
          thumbnail_url: string | null
          title: string | null
          url: string
          view_count: number | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          duration_seconds?: number | null
          id?: string
          is_short?: boolean
          like_count?: number | null
          platform_slug?: string | null
          position?: number
          thumbnail_url?: string | null
          title?: string | null
          url: string
          view_count?: number | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          duration_seconds?: number | null
          id?: string
          is_short?: boolean
          like_count?: number | null
          platform_slug?: string | null
          position?: number
          thumbnail_url?: string | null
          title?: string | null
          url?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_portfolio_items_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          bio: string | null
          city: string | null
          city_slug: string | null
          country: string | null
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
          travels: boolean
          updated_at: string
          verified: boolean
        }
        Insert: {
          bio?: string | null
          city?: string | null
          city_slug?: string | null
          country?: string | null
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
          travels?: boolean
          updated_at?: string
          verified?: boolean
        }
        Update: {
          bio?: string | null
          city?: string | null
          city_slug?: string | null
          country?: string | null
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
          travels?: boolean
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
          engagement_id: string | null
          engagement_month: number | null
          usage_rights_scope: Database["public"]["Enums"]["usage_rights_scope"] | null
          usage_rights_fee: number | null
          shipping_required: boolean
          received_at: string | null
          perf_rate: number | null
          perf_views: number | null
          perf_proof_url: string | null
          perf_declared_at: string | null
          perf_validated_at: string | null
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
          delivered_at: string | null
          escrow_due_at: string | null
          exclusivity: boolean
          exclusivity_days: number | null
          format: Database["public"]["Enums"]["deal_format"]
          id: string
          platform_id: number | null
          quantity: number
          revision_rounds_max: number
          revision_rounds_used: number
          shipped_at: string | null
          shipping_address: Json | null
          shipping_carrier: string | null
          status: Database["public"]["Enums"]["deal_status"]
          title: string | null
          tracking_number: string | null
          updated_at: string
          usage_rights_months: number | null
        }
        Insert: {
          engagement_id?: string | null
          engagement_month?: number | null
          usage_rights_scope?: Database["public"]["Enums"]["usage_rights_scope"] | null
          usage_rights_fee?: number | null
          shipping_required?: boolean
          received_at?: string | null
          perf_rate?: number | null
          perf_views?: number | null
          perf_proof_url?: string | null
          perf_declared_at?: string | null
          perf_validated_at?: string | null
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
          delivered_at?: string | null
          escrow_due_at?: string | null
          exclusivity?: boolean
          exclusivity_days?: number | null
          format: Database["public"]["Enums"]["deal_format"]
          id?: string
          platform_id?: number | null
          quantity?: number
          revision_rounds_max?: number
          revision_rounds_used?: number
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_carrier?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          title?: string | null
          tracking_number?: string | null
          updated_at?: string
          usage_rights_months?: number | null
        }
        Update: {
          engagement_id?: string | null
          engagement_month?: number | null
          usage_rights_scope?: Database["public"]["Enums"]["usage_rights_scope"] | null
          usage_rights_fee?: number | null
          shipping_required?: boolean
          received_at?: string | null
          perf_rate?: number | null
          perf_views?: number | null
          perf_proof_url?: string | null
          perf_declared_at?: string | null
          perf_validated_at?: string | null
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
          delivered_at?: string | null
          escrow_due_at?: string | null
          exclusivity?: boolean
          exclusivity_days?: number | null
          format?: Database["public"]["Enums"]["deal_format"]
          id?: string
          platform_id?: number | null
          quantity?: number
          revision_rounds_max?: number
          revision_rounds_used?: number
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_carrier?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          title?: string | null
          tracking_number?: string | null
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
      engagements: {
        Row: {
          id: string
          brand_id: string
          creator_id: string
          monthly_amount: number
          contents_per_month: number
          months_total: number
          months_created: number
          format: Database["public"]["Enums"]["deal_format"]
          platform_id: number | null
          source_deal_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["engagement_status"]
          ended_at: string | null
          ended_by: string | null
          notice_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          creator_id: string
          monthly_amount: number
          contents_per_month?: number
          months_total: number
          months_created?: number
          format?: Database["public"]["Enums"]["deal_format"]
          platform_id?: number | null
          source_deal_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["engagement_status"]
          ended_at?: string | null
          ended_by?: string | null
          notice_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          creator_id?: string
          monthly_amount?: number
          contents_per_month?: number
          months_total?: number
          months_created?: number
          format?: Database["public"]["Enums"]["deal_format"]
          platform_id?: number | null
          source_deal_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["engagement_status"]
          ended_at?: string | null
          ended_by?: string | null
          notice_days?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
      error_reports: {
        Row: {
          context: string
          detail: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          message: string
          occurrences: number
          resolved_at: string | null
          user_id: string | null
        }
        Insert: {
          context: string
          detail?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message: string
          occurrences?: number
          resolved_at?: string | null
          user_id?: string | null
        }
        Update: {
          context?: string
          detail?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message?: string
          occurrences?: number
          resolved_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      in_kind_benefits: {
        Row: {
          brand_id: string
          created_at: string
          creator_id: string
          deal_id: string | null
          dispute_reason: string | null
          id: string
          label: string
          note: string | null
          sent_at: string
          status: Database["public"]["Enums"]["in_kind_status"]
          updated_at: string
          value: number
        }
        Insert: {
          brand_id: string
          created_at?: string
          creator_id: string
          deal_id?: string | null
          dispute_reason?: string | null
          id?: string
          label: string
          note?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["in_kind_status"]
          updated_at?: string
          value: number
        }
        Update: {
          brand_id?: string
          created_at?: string
          creator_id?: string
          deal_id?: string | null
          dispute_reason?: string | null
          id?: string
          label?: string
          note?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["in_kind_status"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "in_kind_benefits_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "in_kind_benefits_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "in_kind_benefits_deal_id_fkey"
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
          is_admin: boolean
          role: Database["public"]["Enums"]["user_role"]
          role_confirmed: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_admin?: boolean
          role: Database["public"]["Enums"]["user_role"]
          role_confirmed?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          role_confirmed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_buckets: {
        Row: {
          key: string
          tokens: number
          updated_at: string
        }
        Insert: {
          key: string
          tokens: number
          updated_at?: string
        }
        Update: {
          key?: string
          tokens?: number
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
      confirm_user_role: {
        Args: { p_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          tokens_left: number
        }[]
      }
      credit_balance: {
        Args: {
          p_amount: number
          p_brand: string
          p_event?: string
          p_kind: Database["public"]["Enums"]["ledger_kind"]
          p_label?: string
          p_stripe_ref?: string
        }
        Returns: number
      }
      credit_cpa_action: {
        Args: { p_event: string; p_link: string; p_total: number }
        Returns: number
      }
      dispute_in_kind_benefit: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      purge_rate_limit_buckets: { Args: never; Returns: number }
      report_error: {
        Args: {
          p_context: string
          p_detail?: string
          p_message: string
          p_user?: string
        }
        Returns: undefined
      }
      reserve_commission: {
        Args: {
          p_amount: number
          p_brand: string
          p_event: string
          p_label?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      engagement_status: "active" | "ended"
      usage_rights_scope: "organic" | "paid"
      affiliate_event_status:
        | "unfunded"
        | "pending"
        | "validated"
        | "paid"
        | "refunded"
        | "rejected"
      affiliate_event_type: "click" | "sale" | "action"
      application_initiator: "creator" | "brand"
      application_status: "pending" | "accepted" | "rejected" | "withdrawn"
      campaign_status: "draft" | "active" | "ended"
      campaign_type:
        | "affiliation"
        | "video"
        | "hybrid"
        | "performance"
        | "promo_code"
        | "giveaway"
        | "cpa_flat"
        | "cpa_tiers"
      commission_type: "percentage" | "fixed_per_action" | "recurring"
      content_tone: "authentic" | "educational" | "testimonial"
      contract_status: "draft" | "pending_signature" | "signed" | "terminated"
      deal_format: "video_post" | "ugc" | "story" | "reel" | "live"
      deal_status: "negotiation" | "active" | "completed" | "cancelled"
      in_kind_status: "declared" | "disputed" | "cancelled"
      ledger_kind:
        | "topup"
        | "reserve"
        | "reserve_release"
        | "payout"
        | "adjustment"
      offer_type: "ugc" | "post" | "perf" | "affil" | "story"
      product_kind: "physical" | "digital" | "service"
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
      affiliate_event_status: [
        "unfunded",
        "pending",
        "validated",
        "paid",
        "refunded",
        "rejected",
      ],
      affiliate_event_type: ["click", "sale", "action"],
      application_initiator: ["creator", "brand"],
      application_status: ["pending", "accepted", "rejected", "withdrawn"],
      campaign_status: ["draft", "active", "ended"],
      campaign_type: [
        "affiliation",
        "video",
        "hybrid",
        "performance",
        "promo_code",
        "giveaway",
        "cpa_flat",
        "cpa_tiers",
      ],
      commission_type: ["percentage", "fixed_per_action", "recurring"],
      content_tone: ["authentic", "educational", "testimonial"],
      contract_status: ["draft", "pending_signature", "signed", "terminated"],
      deal_format: ["video_post", "ugc", "story", "reel", "live"],
      deal_status: ["negotiation", "active", "completed", "cancelled"],
      in_kind_status: ["declared", "disputed", "cancelled"],
      ledger_kind: [
        "topup",
        "reserve",
        "reserve_release",
        "payout",
        "adjustment",
      ],
      offer_type: ["ugc", "post", "perf", "affil", "story"],
      product_kind: ["physical", "digital", "service"],
      transaction_status: [
        "pending",
        "in_escrow",
        "released",
        "paid",
        "refunded",
        "cancelled",
      ],
      transaction_type: ["deal_payment", "affiliate_payout"],
      user_role: ["creator", "brand"],
    },
  },
} as const
