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
      action_tracker: {
        Row: {
          action_type: string
          context: string | null
          created_at: string
          dedupe_key: string | null
          due_date: string
          id: string
          layer: string | null
          name: string | null
          priority: string
          resolution_note: string | null
          resolved_at: string | null
          source: string | null
          source_ref: string | null
          source_session: string | null
          status: string
          summary: string
          ticker: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          context?: string | null
          created_at?: string
          dedupe_key?: string | null
          due_date: string
          id?: string
          layer?: string | null
          name?: string | null
          priority?: string
          resolution_note?: string | null
          resolved_at?: string | null
          source?: string | null
          source_ref?: string | null
          source_session?: string | null
          status?: string
          summary: string
          ticker?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          context?: string | null
          created_at?: string
          dedupe_key?: string | null
          due_date?: string
          id?: string
          layer?: string | null
          name?: string | null
          priority?: string
          resolution_note?: string | null
          resolved_at?: string | null
          source?: string | null
          source_ref?: string | null
          source_session?: string | null
          status?: string
          summary?: string
          ticker?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
      layer_review_schedule: {
        Row: {
          action_items: Json | null
          completed_date: string | null
          created_at: string | null
          cycle: string
          id: string
          layer: string
          open_trends: number | null
          prompt_template: string | null
          review_vault_path: string | null
          scheduled_date: string
          session_vault_path: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          action_items?: Json | null
          completed_date?: string | null
          created_at?: string | null
          cycle: string
          id?: string
          layer: string
          open_trends?: number | null
          prompt_template?: string | null
          review_vault_path?: string | null
          scheduled_date: string
          session_vault_path?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          action_items?: Json | null
          completed_date?: string | null
          created_at?: string | null
          cycle?: string
          id?: string
          layer?: string
          open_trends?: number | null
          prompt_template?: string | null
          review_vault_path?: string | null
          scheduled_date?: string
          session_vault_path?: string | null
          status?: string
          updated_at?: string | null
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
      narrative_watch: {
        Row: {
          active: boolean
          authored_session: string | null
          category: string
          content: string
          created_at: string
          id: string
          layer: string | null
          source_path: string
          ticker: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          authored_session?: string | null
          category: string
          content: string
          created_at?: string
          id?: string
          layer?: string | null
          source_path: string
          ticker?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          authored_session?: string | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          layer?: string | null
          source_path?: string
          ticker?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      position_reference: {
        Row: {
          first_add_date: string | null
          pe_at_first_add: number | null
          price_at_first_add: number | null
          reclass_status_at_entry: string | null
          ticker: string
        }
        Insert: {
          first_add_date?: string | null
          pe_at_first_add?: number | null
          price_at_first_add?: number | null
          reclass_status_at_entry?: string | null
          ticker: string
        }
        Update: {
          first_add_date?: string | null
          pe_at_first_add?: number | null
          price_at_first_add?: number | null
          reclass_status_at_entry?: string | null
          ticker?: string
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
      scheduled_reviews: {
        Row: {
          cadence: string
          created_at: string
          id: string
          last_completed: string | null
          next_due: string
          notes: string | null
          review_type: string
          status: string
          ticker: string | null
          title: string
          updated_at: string
          vault_path: string | null
        }
        Insert: {
          cadence?: string
          created_at?: string
          id?: string
          last_completed?: string | null
          next_due: string
          notes?: string | null
          review_type: string
          status?: string
          ticker?: string | null
          title: string
          updated_at?: string
          vault_path?: string | null
        }
        Update: {
          cadence?: string
          created_at?: string
          id?: string
          last_completed?: string | null
          next_due?: string
          notes?: string | null
          review_type?: string
          status?: string
          ticker?: string | null
          title?: string
          updated_at?: string
          vault_path?: string | null
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
          mos_rationale: string | null
          mos_score: number | null
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
          mos_rationale?: string | null
          mos_score?: number | null
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
          mos_rationale?: string | null
          mos_score?: number | null
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
        }
        Relationships: []
      }
      scores_snapshot: {
        Row: {
          action: string | null
          bb_target_date: string | null
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
          div_yield: number | null
          framework: string | null
          held_status: string | null
          id: number
          layer: string
          margin_of_safety: number
          mgmt: number
          moat: number
          reclass_status: string | null
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
        }
        Insert: {
          action?: string | null
          bb_target_date?: string | null
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
          div_yield?: number | null
          framework?: string | null
          held_status?: string | null
          id?: never
          layer: string
          margin_of_safety: number
          mgmt: number
          moat: number
          reclass_status?: string | null
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
        }
        Update: {
          action?: string | null
          bb_target_date?: string | null
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
          div_yield?: number | null
          framework?: string | null
          held_status?: string | null
          id?: never
          layer?: string
          margin_of_safety?: number
          mgmt?: number
          moat?: number
          reclass_status?: string | null
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
        }
        Relationships: []
      }
      ticker_aliases: {
        Row: {
          created_at: string
          exchange: string | null
          skip: boolean
          ticker: string
          updated_at: string
          yahoo_symbol: string | null
        }
        Insert: {
          created_at?: string
          exchange?: string | null
          skip?: boolean
          ticker: string
          updated_at?: string
          yahoo_symbol?: string | null
        }
        Update: {
          created_at?: string
          exchange?: string | null
          skip?: boolean
          ticker?: string
          updated_at?: string
          yahoo_symbol?: string | null
        }
        Relationships: []
      }
      vault_backlinks: {
        Row: {
          id: number
          indexed_at: string
          source_path: string
          source_type: string
          target_id: string
          target_type: string
        }
        Insert: {
          id?: number
          indexed_at?: string
          source_path: string
          source_type: string
          target_id: string
          target_type: string
        }
        Update: {
          id?: number
          indexed_at?: string
          source_path?: string
          source_type?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      vault_notes_meta: {
        Row: {
          body: string | null
          body_sections: Json | null
          frontmatter: Json | null
          fts: unknown
          identifier: string | null
          last_indexed: string
          path: string
          ticker: string | null
          title: string | null
          type: string
        }
        Insert: {
          body?: string | null
          body_sections?: Json | null
          frontmatter?: Json | null
          fts?: unknown
          identifier?: string | null
          last_indexed?: string
          path: string
          ticker?: string | null
          title?: string | null
          type: string
        }
        Update: {
          body?: string | null
          body_sections?: Json | null
          frontmatter?: Json | null
          fts?: unknown
          identifier?: string | null
          last_indexed?: string
          path?: string
          ticker?: string | null
          title?: string | null
          type?: string
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
      capital_flows_daily: {
        Row: {
          account: string | null
          capital_flow_gbp: number | null
          delta_shares: number | null
          factor_group: string | null
          flow_type: string | null
          layer: string | null
          mv_gbp: number | null
          prev_mv_gbp: number | null
          prev_shares: number | null
          price_local: number | null
          shares: number | null
          snapshot_date: string | null
          ticker: string | null
        }
        Relationships: []
      }
      perf_dimension_summary: {
        Row: {
          dimension: string | null
          group_name: string | null
          position_count: number | null
          total_mv_gbp: number | null
          weighted_return_pct: number | null
        }
        Relationships: []
      }
      perf_portfolio_daily: {
        Row: {
          daily_pnl_gbp: number | null
          daily_return_pct: number | null
          position_count: number | null
          snapshot_date: string | null
          total_mv_gbp: number | null
        }
        Relationships: []
      }
      perf_position_daily: {
        Row: {
          account: string | null
          daily_pnl_gbp: number | null
          factor_group: string | null
          framework: string | null
          gl_pct: number | null
          layer: string | null
          mv_gbp: number | null
          reclass_status: string | null
          return_profile: string | null
          score: number | null
          snapshot_date: string | null
          ticker: string | null
          tier: string | null
        }
        Relationships: []
      }
      perf_rolling_window: {
        Row: {
          account: string | null
          compounder_subtype: string | null
          factor_group: string | null
          framework: string | null
          has_capital_flow: boolean | null
          held_status: string | null
          layer: string | null
          mv_end: number | null
          mv_return_pct: number | null
          mv_start: number | null
          net_capital_flow_gbp: number | null
          price_end: number | null
          price_return_pct: number | null
          price_start: number | null
          reclass_status: string | null
          return_profile: string | null
          shares_end: number | null
          shares_start: number | null
          ticker: string | null
          trade_count: number | null
          window_days: number | null
        }
        Relationships: []
      }
      test5_early_warning: {
        Row: {
          current_price: number | null
          entry_pe: number | null
          first_add_date: string | null
          months_elapsed: number | null
          mv_gbp: number | null
          pe_at_first_add: number | null
          price_at_first_add: number | null
          price_move_pct: number | null
          price_proximity_pct: number | null
          reclass_status: string | null
          test5_signal: string | null
          ticker: string | null
          time_proximity_pct: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      capital_flows_by_dimension: {
        Args: { p_dimension: string; p_window: number }
        Returns: {
          buy_count: number
          dimension_value: string
          net_flow_gbp: number
          sell_count: number
          tickers_traded: string[]
          total_buys_gbp: number
          total_sells_gbp: number
        }[]
      }
      get_missing_watchlist_tickers: {
        Args: { tickers: string[] }
        Returns: string[]
      }
      perf_by_dimension_window: {
        Args: { p_dimension: string; p_window: number }
        Returns: {
          bottom_contributor: string
          dimension_value: string
          mv_end_gbp: number
          mv_return_pct: number
          mv_start_gbp: number
          net_capital_flow_gbp: number
          position_count: number
          price_return_pct: number
          top_contributor: string
          trade_count: number
        }[]
      }
      upsert_position_reference: {
        Args: {
          p_action?: string
          p_first_add_date?: string
          p_pe_at_first_add?: number
          p_price_at_first_add?: number
          p_reclass_status?: string
          p_ticker: string
        }
        Returns: string
      }
      upsert_watchlist_prices: { Args: { prices: Json }; Returns: number }
      vault_list_by_type: {
        Args: { p_type: string }
        Returns: {
          identifier: string
          path: string
          sections: string[]
          title: string
        }[]
      }
      vault_search: {
        Args: { max_results?: number; note_type?: string; search_query: string }
        Returns: {
          body_sections: Json
          frontmatter: Json
          identifier: string
          path: string
          rank: number
          snippet: string
          title: string
          type: string
        }[]
      }
      vault_search_with_backlinks: {
        Args: {
          include_backlinks?: boolean
          max_results?: number
          note_type?: string
          search_query: string
        }
        Returns: {
          backlinks: Json
          body_sections: Json
          frontmatter: Json
          identifier: string
          path: string
          rank: number
          snippet: string
          title: string
          type: string
        }[]
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
