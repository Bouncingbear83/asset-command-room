import { describe, it, expect } from "vitest";
import { mapTrajectories } from "./useWatchlistHistory";
import { emptyLabel } from "@/components/watchlist/WatchlistSparkline";

const row = (ticker: string) => ({
  ticker, spark30d: [{ date: "2026-10-01", close: 100 }, { date: "2026-10-02", close: "101" }],
  current_close: 101, price_7d_ago: 95, price_30d_ago: 90, high_52w: 120, low_52w: 80,
  first_date: "2024-01-02", last_date: "2026-10-02", row_count: 700,
});

describe("mapTrajectories", () => {
  it("maps late-alphabet tickers and keeps empty entries for gaps", () => {
    const { byTicker, missing } = mapTrajectories(["KLAC", "LSCC", "ZZZ"], [row("klac"), row("LSCC")]);
    expect(byTicker.LSCC.spark30d).toHaveLength(2);
    expect(byTicker.LSCC.price7dAgo).toBe(95);
    expect(byTicker.KLAC.rowCount).toBe(700);
    expect(missing).toEqual(["ZZZ"]);
    expect(byTicker.ZZZ.spark30d).toEqual([]);
  });
});

describe("emptyLabel", () => {
  it("PRIVATE / SYMBOL? / default", () => {
    expect(emptyLabel("PRIVATE")).toBe("PRIVATE");
    expect(emptyLabel("UNRESOLVED")).toBe("SYMBOL?");
    expect(emptyLabel(undefined)).toBe("No price history yet");
  });
});
