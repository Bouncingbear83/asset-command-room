import { describe, it, expect, vi, beforeEach } from "vitest";

const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => from(...a) },
}));

import { renderHook, waitFor } from "@testing-library/react";
import { useTest5Warning } from "./useTest5Warning";

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

const row = {
  ticker: "NVDA",
  current_price: 100,
  mv_gbp: 5000,
  reclass_status: "OK",
  price_at_first_add: 80,
  pe_at_first_add: 40,
  first_add_date: "2024-06-01",
  price_move_pct: 25,
  price_proximity_pct: 90,
  months_elapsed: 6,
  time_proximity_pct: 50,
  entry_pe: 40,
  test5_signal: "TRIGGERED" as const,
};

describe("useTest5Warning", () => {
  beforeEach(() => {
    from.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("splits rows by signal on success", async () => {
    const rows = [
      row,
      { ...row, ticker: "AAPL", test5_signal: "WATCH" as const },
      { ...row, ticker: "MSFT", test5_signal: "CLEAR" as const },
    ];
    from.mockReturnValue(chain({ data: rows, error: null }));

    const { result } = renderHook(() => useTest5Warning());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.data).toHaveLength(3);
    expect(result.current.triggered.map((r) => r.ticker)).toEqual(["NVDA"]);
    expect(result.current.watching.map((r) => r.ticker)).toEqual(["AAPL"]);
    expect(result.current.clear.map((r) => r.ticker)).toEqual(["MSFT"]);
  });

  it("returns an error string and empty arrays on supabase error", async () => {
    from.mockReturnValue(chain({ data: null, error: { message: "nope" } }));

    const { result } = renderHook(() => useTest5Warning());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("test5: nope");
    expect(result.current.data).toEqual([]);
    expect(result.current.triggered).toEqual([]);
  });

  it("drops rows with an invalid test5_signal", async () => {
    const bad = { ...row, ticker: "BAD", test5_signal: "UNKNOWN" as any };
    from.mockReturnValue(chain({ data: [row, bad], error: null }));

    const { result } = renderHook(() => useTest5Warning());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.map((r) => r.ticker)).toEqual(["NVDA"]);
    expect(result.current.error).toBeNull();
  });

  it("tolerates a SelectQueryError-shaped response (non-array data)", async () => {
    from.mockReturnValue(chain({ data: { error: true } as any, error: null }));

    const { result } = renderHook(() => useTest5Warning());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
