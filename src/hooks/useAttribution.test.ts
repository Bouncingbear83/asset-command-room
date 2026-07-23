import { z } from "zod";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client BEFORE importing the hook.
const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => from(...a), rpc: (...a: any[]) => rpc(...a) },
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import { useAttribution } from "./useAttribution";

function chain(result: { data: any; error: any }) {
  const p = Promise.resolve(result);
  const api: any = {
    select: () => api,
    order: () => api,
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  };
  return api;
}

const dailyRow = {
  snapshot_date: "2025-01-01",
  total_mv_gbp: 100,
  position_count: 5,
  daily_pnl_gbp: 1,
  daily_return_pct: 0.01,
};
const rollingRow = {
  ticker: "NVDA", account: "GIA", window_days: 30, layer: "Core",
  factor_group: "AI", return_profile: "growth", reclass_status: "OK",
  framework: "6D", mv_start: 100, mv_end: 110, price_start: 10, price_end: 11,
  price_return_pct: 10, mv_return_pct: 10, net_capital_flow_gbp: 0, trade_count: 0,
  has_capital_flow: false,
};
const dimRow = {
  dimension_value: "Core", position_count: 5, mv_start_gbp: 100, mv_end_gbp: 110,
  price_return_pct: 10, mv_return_pct: 10, net_capital_flow_gbp: 0, trade_count: 0,
  top_contributor: "NVDA", bottom_contributor: null,
};

describe("useAttribution", () => {
  beforeEach(() => {
    from.mockReset();
    rpc.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("parses successful responses and exposes typed rows", async () => {
    from.mockImplementation((tbl: string) => {
      if (tbl === "perf_portfolio_daily") return chain({ data: [dailyRow], error: null });
      if (tbl === "perf_rolling_window") return chain({ data: [rollingRow], error: null });
      return chain({ data: [], error: null });
    });
    rpc.mockResolvedValue({ data: [dimRow], error: null });

    const { result } = renderHook(() => useAttribution());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.portfolioDaily).toEqual([dailyRow]);
    expect(result.current.rollingWindow).toEqual([rollingRow]);
    expect(result.current.dimensionData).toEqual([dimRow]);
  });

  it("propagates the supabase error message and yields empty arrays", async () => {
    from.mockImplementation((tbl: string) => {
      if (tbl === "perf_portfolio_daily") return chain({ data: null, error: { message: "boom" } });
      return chain({ data: [], error: null });
    });
    rpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useAttribution());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("portfolio_daily: boom");
    expect(result.current.portfolioDaily).toEqual([]);
    expect(result.current.rollingWindow).toEqual([]);
    expect(result.current.dimensionData).toEqual([]);
  });

  it("drops rows that fail schema validation but keeps the valid ones", async () => {
    const badDaily = { snapshot_date: 123, total_mv_gbp: "nope" }; // wrong types
    from.mockImplementation((tbl: string) => {
      if (tbl === "perf_portfolio_daily")
        return chain({ data: [dailyRow, badDaily], error: null });
      return chain({ data: [], error: null });
    });
    rpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useAttribution());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.portfolioDaily).toEqual([dailyRow]);
    expect(result.current.error).toBeNull();
  });

  it("survives a SelectQueryError-shaped response (non-array data)", async () => {
    from.mockImplementation(() =>
      chain({ data: { error: true } as any, error: null }),
    );
    rpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useAttribution());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.portfolioDaily).toEqual([]);
    expect(result.current.rollingWindow).toEqual([]);
    expect(result.current.dimensionData).toEqual([]);
  });
});
