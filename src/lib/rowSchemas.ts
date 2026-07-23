import { z } from "zod";

/**
 * Row schemas for Supabase responses.
 * Kept permissive (numbers/strings only) — we only need to guarantee shape,
 * not enforce business invariants.
 */

export const PortfolioDailyRowSchema = z.object({
  snapshot_date: z.string(),
  total_mv_gbp: z.number(),
  position_count: z.number(),
  daily_pnl_gbp: z.number().nullable(),
  daily_return_pct: z.number().nullable(),
});
export type PortfolioDailyRow = z.infer<typeof PortfolioDailyRowSchema>;

export const RollingWindowRowSchema = z.object({
  ticker: z.string(),
  account: z.string(),
  window_days: z.number(),
  layer: z.string(),
  factor_group: z.string(),
  return_profile: z.string().nullable(),
  reclass_status: z.string(),
  framework: z.string(),
  mv_start: z.number().nullable(),
  mv_end: z.number(),
  price_start: z.number().nullable(),
  price_end: z.number().nullable(),
  price_return_pct: z.number().nullable(),
  mv_return_pct: z.number().nullable(),
  net_capital_flow_gbp: z.number(),
  trade_count: z.number(),
  has_capital_flow: z.boolean(),
});
export type RollingWindowRow = z.infer<typeof RollingWindowRowSchema>;

export const DimensionWindowRowSchema = z.object({
  dimension_value: z.string(),
  position_count: z.number(),
  mv_start_gbp: z.number(),
  mv_end_gbp: z.number(),
  price_return_pct: z.number(),
  mv_return_pct: z.number(),
  net_capital_flow_gbp: z.number(),
  trade_count: z.number(),
  top_contributor: z.string().nullable(),
  bottom_contributor: z.string().nullable(),
});
export type DimensionWindowRow = z.infer<typeof DimensionWindowRowSchema>;

export const Test5RowSchema = z.object({
  ticker: z.string(),
  current_price: z.number(),
  mv_gbp: z.number(),
  reclass_status: z.string(),
  price_at_first_add: z.number().nullable(),
  pe_at_first_add: z.number().nullable(),
  first_add_date: z.string().nullable(),
  price_move_pct: z.number().nullable(),
  price_proximity_pct: z.number().nullable(),
  months_elapsed: z.number().nullable(),
  time_proximity_pct: z.number().nullable(),
  entry_pe: z.number().nullable(),
  test5_signal: z.enum(["CLEAR", "WATCH", "TRIGGERED"]),
});
export type Test5Row = z.infer<typeof Test5RowSchema>;
