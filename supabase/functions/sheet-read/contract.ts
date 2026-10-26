import { z } from "npm:zod@3";
export const SHEET_KEYS = ["HOLDINGS", "HOLDINGS_CASH", "WATCHLIST", "LAYERS", "SCORES", "SCORE_LOG", "MONITOR", "DISRUPTION", "PERFORMANCE", "NARRATIVE", "MACRO_STATE", "EARNINGS_CALENDAR", "CASH", "TRANSACTIONS", "JISA_HOLDINGS", "PRICES"] as const;
export const RequestSchema = z.object({ keys: z.array(z.enum(SHEET_KEYS)).min(1).max(20) }).strict();
const Cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const SuccessSchema = z.object({ status: z.literal("success"), fetched_at: z.string().datetime(), ranges: z.record(z.object({ range: z.string(), values: z.array(z.array(Cell)), formatted: z.array(z.array(Cell)) })), errors: z.record(z.string()) });
export function cacheKey(keys: string[]) { return [...new Set(keys)].sort().join("|"); }
export function upstreamFailure(code: unknown) {
  return code === "UNAUTHORISED" || code === "NOT_CONFIGURED" ? 500 : 502;
}
