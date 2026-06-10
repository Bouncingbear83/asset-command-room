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
      alerts_log: {
        Row: {
          alert_type: string
          created_at: string
          id: number
          new_status: string
          note: string | null
          previous_status: string | null
          source: string
          threshold: string | null
          ticker: string
          trigger_value: string | null
          triggered_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: never
          new_status: string
          note?: string | null
          previous_status?: string | null
          source?: string
          threshold?: string | null
          ticker: string
          trigger_value?: string | null
          triggered_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: never
          new_status?: string
          note?: string | null
          previous_status?: string | null
          source?: string
          threshold?: string | null
          ticker?: string
          trigger_value?: string | null
          triggered_at?: string
        }
        Relationships: []
      }
      daily_prices: {
        Row: {
          created_at: string
          currency: string
          day_change_pct: number | null
          high_52w: number | null
          id: number
          low_52w: number | null
          ma60: number | null
          prev_close_local: number | null
          price_gbp: number
          price_local: number
          snapshot_date: string
          source: string
          ticker: string
        }
        Insert: {
          created_at?: string
          currency: string
          day_change_pct?: number | null
          high_52w?: number | null
          id?: never
          low_52w?: number | null
          ma60?: number | null
          prev_close_local?: number | null
          price_gbp: number
          price_local: number
          snapshot_date: string
          source?: string
          ticker: string
        }
        Update: {
          created_at?: string
          currency?: string
          day_change_pct?: number | null
          high_52w?: number | null
          id?: never
          low_52w?: number | null
          ma60?: number | null
          prev_close_local?: number | null
          price_gbp?: number
          price_local?: number
          snapshot_date?: string
          source?: string
          ticker?: string
        }
        Relationships: []
      }
      disruption_rationales: {
        Row: {
          amber_trigger: string | null
          change_note: string | null
          created_at: string
          demand_vuln_rationale: string | null
          demand_vuln_score: number | null
          disruption_score: number
          economics_rationale: string | null
          economics_score: number | null
          evidence: string | null
          govt_support_rationale: string | null
          govt_support_score: number | null
          id: number
          red_trigger: string | null
          scored_at: string
          scored_by: string
          status: string | null
          sub_avail_rationale: string | null
          sub_avail_score: number | null
          ticker: string
          time_viability_rationale: string | null
          time_viability_score: number | null
        }
        Insert: {
          amber_trigger?: string | null
          change_note?: string | null
          created_at?: string
          demand_vuln_rationale?: string | null
          demand_vuln_score?: number | null
          disruption_score: number
          economics_rationale?: string | null
          economics_score?: number | null
          evidence?: string | null
          govt_support_rationale?: string | null
          govt_support_score?: number | null
          id?: never
          red_trigger?: string | null
          scored_at: string
          scored_by: string
          status?: string | null
          sub_avail_rationale?: string | null
          sub_avail_score?: number | null
          ticker: string
          time_viability_rationale?: string | null
          time_viability_score?: number | null
        }
        Update: {
          amber_trigger?: string | null
          change_note?: string | null
          created_at?: string
          demand_vuln_rationale?: string | null
          demand_vuln_score?: number | null
          disruption_score?: number
          economics_rationale?: string | null
          economics_score?: number | null
          evidence?: string | null
          govt_support_rationale?: string | null
          govt_support_score?: number | null
          id?: never
          red_trigger?: string | null
          scored_at?: string
          scored_by?: string
          status?: string | null
          sub_avail_rationale?: string | null
          sub_avail_score?: number | null
          ticker?: string
          time_viability_rationale?: string | null
          time_viability_score?: number | null
        }
        Relationships: []
      }
      disruption_snapshot: {
        Row: {
          created_at: string
          demand_vuln: number | null
          disruption_score: number
          economics: number | null
          govt_support: number | null
          id: number
          snapshot_date: string
          source: string
          status: string | null
          sub_avail: number | null
          ticker: string
          time_viability: number | null
        }
        Insert: {
          created_at?: string
          demand_vuln?: number | null
          disruption_score: number
          economics?: number | null
          govt_support?: number | null
          id?: never
          snapshot_date: string
          source?: string
          status?: string | null
          sub_avail?: number | null
          ticker: string
          time_viability?: number | null
        }
        Update: {
          created_at?: string
          demand_vuln?: number | null
          disruption_score?: number
          economics?: number | null
          govt_support?: number | null
          id?: never
          snapshot_date?: string
          source?: string
          status?: string | null
          sub_avail?: number | null
          ticker?: string
          time_viability?: number | null
        }
        Relationships: []
      }
      factor_group_weights: {
        Row: {
          created_at: string | null
          current_pct: number | null
          factor_group: string
          id: number
          mv_gbp: number | null
          priority: string | null
          snapshot_date: string
          source: string | null
        }
        Insert: {
          created_at?: string | null
          current_pct?: number | null
          factor_group: string
          id?: number
          mv_gbp?: number | null
          priority?: string | null
          snapshot_date: string
          source?: string | null
        }
        Update: {
          created_at?: string | null
          current_pct?: number | null
          factor_group?: string
          id?: number
          mv_gbp?: number | null
          priority?: string | null
          snapshot_date?: string
          source?: string | null
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          created_at: string
          id: number
          pair: string
          rate: number
          snapshot_date: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: never
          pair: string
          rate: number
          snapshot_date: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: never
          pair?: string
          rate?: number
          snapshot_date?: string
          source?: string
        }
        Relationships: []
      }
      holdings_snapshot: {
        Row: {
          account: string
          action: string | null
          alert_status: string | null
          aum_pct: number | null
          cost_gbp: number | null
          created_at: string
          currency: string
          deploy_target_gbp: number | null
          factor_group: string | null
          factor_primary: string | null
          gl_pct: number | null
          id: number
          layer: string
          mv_gbp: number
          price_local: number
          shares: number
          snapshot_date: string
          source: string
          stack_layer: string | null
          substrate_level: string | null
          substrate_stage: string | null
          ticker: string
        }
        Insert: {
          account: string
          action?: string | null
          alert_status?: string | null
          aum_pct?: number | null
          cost_gbp?: number | null
          created_at?: string
          currency: string
          deploy_target_gbp?: number | null
          factor_group?: string | null
          factor_primary?: string | null
          gl_pct?: number | null
          id?: never
          layer: string
          mv_gbp: number
          price_local: number
          shares: number
          snapshot_date: string
          source?: string
          stack_layer?: string | null
          substrate_level?: string | null
          substrate_stage?: string | null
          ticker: string
        }
        Update: {
          account?: string
          action?: string | null
          alert_status?: string | null
          aum_pct?: number | null
          cost_gbp?: number | null
          created_at?: string
          currency?: string
          deploy_target_gbp?: number | null
          factor_group?: string | null
          factor_primary?: string | null
          gl_pct?: number | null
          id?: never
          layer?: string
          mv_gbp?: number
          price_local?: number
          shares?: number
          snapshot_date?: string
          source?: string
          stack_layer?: string | null
          substrate_level?: string | null
          substrate_stage?: string | null
          ticker?: string
        }
        Relationships: []
      }
      jisa_snapshot: {
        Row: {
          child: string
          cost_gbp: number | null
          created_at: string
          currency: string
          gl_pct: number | null
          id: number
          layer: string
          mv_gbp: number
          price_local: number
          shares: number
          snapshot_date: string
          source: string
          target_pct: number | null
          ticker: string
          type: string
          weight_pct: number | null
        }
        Insert: {
          child: string
          cost_gbp?: number | null
          created_at?: string
          currency: string
          gl_pct?: number | null
          id?: never
          layer: string
          mv_gbp: number
          price_local: number
          shares: number
          snapshot_date: string
          source?: string
          target_pct?: number | null
          ticker: string
          type: string
          weight_pct?: number | null
        }
        Update: {
          child?: string
          cost_gbp?: number | null
          created_at?: string
          currency?: string
          gl_pct?: number | null
          id?: never
          layer?: string
          mv_gbp?: number
          price_local?: number
          shares?: number
          snapshot_date?: string
          source?: string
          target_pct?: number | null
          ticker?: string
          type?: string
          weight_pct?: number | null
        }
        Relationships: []
      }
      layer_weights_snapshot: {
        Row: {
          created_at: string
          current_pct: number
          gap_pct: number | null
          id: number
          layer: string
          mv_gbp: number | null
          priority: string | null
          snapshot_date: string
          source: string
          target_pct: number
        }
        Insert: {
          created_at?: string
          current_pct: number
          gap_pct?: number | null
          id?: never
          layer: string
          mv_gbp?: number | null
          priority?: string | null
          snapshot_date: string
          source?: string
          target_pct: number
        }
        Update: {
          created_at?: string
          current_pct?: number
          gap_pct?: number | null
          id?: never
          layer?: string
          mv_gbp?: number | null
          priority?: string | null
          snapshot_date?: string
          source?: string
          target_pct?: number
        }
        Relationships: []
      }
      macro_snapshot: {
        Row: {
          brent_usd: number | null
          copper_spot_usd_lb: number | null
          created_at: string
          gbpusd: number | null
          gold_usd: number | null
          id: number
          pause_active: boolean | null
          snapshot_date: string
          source: string
          sp500_ytd_pct: number | null
          uranium_spot_usd: number | null
          vix: number | null
        }
        Insert: {
          brent_usd?: number | null
          copper_spot_usd_lb?: number | null
          created_at?: string
          gbpusd?: number | null
          gold_usd?: number | null
          id?: never
          pause_active?: boolean | null
          snapshot_date: string
          source?: string
          sp500_ytd_pct?: number | null
          uranium_spot_usd?: number | null
          vix?: number | null
        }
        Update: {
          brent_usd?: number | null
          copper_spot_usd_lb?: number | null
          created_at?: string
          gbpusd?: number | null
          gold_usd?: number | null
          id?: never
          pause_active?: boolean | null
          snapshot_date?: string
          source?: string
          sp500_ytd_pct?: number | null
          uranium_spot_usd?: number | null
          vix?: number | null
        }
        Relationships: []
      }
      narrative_signals: {
        Row: {
          created_at: string
          headline: string | null
          id: string
          layer: string | null
          matched_keywords: string | null
          name: string
          published_date: string | null
          review_note: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          run_id: string
          run_started_at: string
          signal_class: string
          snippet: string | null
          source_table: string
          strength: string
          ticker: string
          url: string | null
        }
        Insert: {
          created_at?: string
          headline?: string | null
          id?: string
          layer?: string | null
          matched_keywords?: string | null
          name: string
          published_date?: string | null
          review_note?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id: string
          run_started_at: string
          signal_class: string
          snippet?: string | null
          source_table: string
          strength: string
          ticker: string
          url?: string | null
        }
        Update: {
          created_at?: string
          headline?: string | null
          id?: string
          layer?: string | null
          matched_keywords?: string | null
          name?: string
          published_date?: string | null
          review_note?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id?: string
          run_started_at?: string
          signal_class?: string
          snippet?: string | null
          source_table?: string
          strength?: string
          ticker?: string
          url?: string | null
        }
        Relationships: []
      }
      research_reports: {
        Row: {
          created_at: string | null
          id: string
          is_latest: boolean
          layer: string | null
          name: string | null
          prob_weighted_ev: number | null
          quartet_json: Json | null
          reclass_status: string | null
          report_date: string
          report_html: string
          score: number | null
          spot_at_report: number | null
          summary: string | null
          ticker: string
          tier: string | null
          updated_at: string | null
          version: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_latest?: boolean
          layer?: string | null
          name?: string | null
          prob_weighted_ev?: number | null
          quartet_json?: Json | null
          reclass_status?: string | null
          report_date: string
          report_html: string
          score?: number | null
          spot_at_report?: number | null
          summary?: string | null
          ticker: string
          tier?: string | null
          updated_at?: string | null
          version?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_latest?: boolean
          layer?: string | null
          name?: string | null
          prob_weighted_ev?: number | null
          quartet_json?: Json | null
          reclass_status?: string | null
          report_date?: string
          report_html?: string
          score?: number | null
          spot_at_report?: number | null
          summary?: string | null
          ticker?: string
          tier?: string | null
          updated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      score_rationales: {
        Row: {
          action: string
          asymmetry_ratio: string | null
          bear_case: string | null
          bull_case: string | null
          change_note: string | null
          china_exposure_flag: string | null
          created_at: string
          demand_rationale: string
          demand_score: number
          disruption_rationale: string
          disruption_score: number
          factor_group: string | null
          factor_primary: string | null
          first_add_date: string | null
          id: number
          mgmt_rationale: string
          mgmt_score: number
          moat_rationale: string
          moat_score: number
          mv_gbp_at_scoring: number | null
          pre_reclass_modifier: number | null
          price_at_first_add: number | null
          price_at_last_score: number | null
          price_at_scoring: number | null
          s3_transition_modifier: number | null
          scored_at: string
          scored_by: string
          stack_layer: string | null
          stage2_subclass: string | null
          substrate_level: string | null
          substrate_rationale: string
          substrate_score: number
          thesis_summary: string | null
          ticker: string
          tier: string | null
          total_score: number
          valuation_rationale: string
          valuation_score: number
        }
        Insert: {
          action: string
          asymmetry_ratio?: string | null
          bear_case?: string | null
          bull_case?: string | null
          change_note?: string | null
          china_exposure_flag?: string | null
          created_at?: string
          demand_rationale: string
          demand_score: number
          disruption_rationale: string
          disruption_score: number
          factor_group?: string | null
          factor_primary?: string | null
          first_add_date?: string | null
          id?: never
          mgmt_rationale: string
          mgmt_score: number
          moat_rationale: string
          moat_score: number
          mv_gbp_at_scoring?: number | null
          pre_reclass_modifier?: number | null
          price_at_first_add?: number | null
          price_at_last_score?: number | null
          price_at_scoring?: number | null
          s3_transition_modifier?: number | null
          scored_at: string
          scored_by: string
          stack_layer?: string | null
          stage2_subclass?: string | null
          substrate_level?: string | null
          substrate_rationale: string
          substrate_score: number
          thesis_summary?: string | null
          ticker: string
          tier?: string | null
          total_score: number
          valuation_rationale: string
          valuation_score: number
        }
        Update: {
          action?: string
          asymmetry_ratio?: string | null
          bear_case?: string | null
          bull_case?: string | null
          change_note?: string | null
          china_exposure_flag?: string | null
          created_at?: string
          demand_rationale?: string
          demand_score?: number
          disruption_rationale?: string
          disruption_score?: number
          factor_group?: string | null
          factor_primary?: string | null
          first_add_date?: string | null
          id?: never
          mgmt_rationale?: string
          mgmt_score?: number
          moat_rationale?: string
          moat_score?: number
          mv_gbp_at_scoring?: number | null
          pre_reclass_modifier?: number | null
          price_at_first_add?: number | null
          price_at_last_score?: number | null
          price_at_scoring?: number | null
          s3_transition_modifier?: number | null
          scored_at?: string
          scored_by?: string
          stack_layer?: string | null
          stage2_subclass?: string | null
          substrate_level?: string | null
          substrate_rationale?: string
          substrate_score?: number
          thesis_summary?: string | null
          ticker?: string
          tier?: string | null
          total_score?: number
          valuation_rationale?: string
          valuation_score?: number
        }
        Relationships: []
      }
      scores_snapshot: {
        Row: {
          action: string | null
          bear_substrate_fail: number | null
          bear_thesis_weak: number | null
          bull_base: number | null
          bull_bear_at_date: string | null
          bull_stretch: number | null
          buy_high: number | null
          buy_low: number | null
          compounder_subtype: string | null
          created_at: string
          demand: number
          disruption: number
          id: number
          layer: string
          mgmt: number
          moat: number
          reject_reason: string | null
          return_profile: string | null
          s3_transition_modifier: number | null
          score: number
          snapshot_date: string
          source: string
          stack_layer: string | null
          stellar_type: string | null
          substrate: number
          substrate_level: string | null
          substrate_stage: string | null
          ticker: string
          tier: string | null
          valuation: number
        }
        Insert: {
          action?: string | null
          bear_substrate_fail?: number | null
          bear_thesis_weak?: number | null
          bull_base?: number | null
          bull_bear_at_date?: string | null
          bull_stretch?: number | null
          buy_high?: number | null
          buy_low?: number | null
          compounder_subtype?: string | null
          created_at?: string
          demand: number
          disruption: number
          id?: never
          layer: string
          mgmt: number
          moat: number
          reject_reason?: string | null
          return_profile?: string | null
          s3_transition_modifier?: number | null
          score: number
          snapshot_date: string
          source?: string
          stack_layer?: string | null
          stellar_type?: string | null
          substrate: number
          substrate_level?: string | null
          substrate_stage?: string | null
          ticker: string
          tier?: string | null
          valuation: number
        }
        Update: {
          action?: string | null
          bear_substrate_fail?: number | null
          bear_thesis_weak?: number | null
          bull_base?: number | null
          bull_bear_at_date?: string | null
          bull_stretch?: number | null
          buy_high?: number | null
          buy_low?: number | null
          compounder_subtype?: string | null
          created_at?: string
          demand?: number
          disruption?: number
          id?: never
          layer?: string
          mgmt?: number
          moat?: number
          reject_reason?: string | null
          return_profile?: string | null
          s3_transition_modifier?: number | null
          score?: number
          snapshot_date?: string
          source?: string
          stack_layer?: string | null
          stellar_type?: string | null
          substrate?: number
          substrate_level?: string | null
          substrate_stage?: string | null
          ticker?: string
          tier?: string | null
          valuation?: number
        }
        Relationships: []
      }
      watchlist_price_history: {
        Row: {
          close_price: number
          created_at: string | null
          currency: string
          id: number
          snapshot_date: string
          source: string | null
          ticker: string
        }
        Insert: {
          close_price: number
          created_at?: string | null
          currency: string
          id?: number
          snapshot_date: string
          source?: string | null
          ticker: string
        }
        Update: {
          close_price?: number
          created_at?: string | null
          currency?: string
          id?: number
          snapshot_date?: string
          source?: string | null
          ticker?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_missing_watchlist_tickers: {
        Args: { tickers: string[] }
        Returns: string[]
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
