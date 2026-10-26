import { describe, it, expect } from "vitest";
import { sheetGrid, sheetObjectRows, type SheetBatch } from "@/hooks/usePortfolioData";
import { parseHoldingsCashBlock } from "./canonical";
const batch: SheetBatch = {
  status: "success", fetched_at: "2026-10-25T12:00:00.000Z", errors: {},
  ranges: { HOLDINGS_CASH: { range: "HOLDINGS!A56:F65", values: [[], [], ["CASH", "", "", "", 166677.05, 0.11393764231253767], [], ["", "", "", "", 1462879.5770830067, 1], [], ["CASH", "", "SIPP", "", 92299.83], ["", "", "ISA", "", 48300.22], ["", "", "Bordier", "", 26077], ["", "", "Total", "", 166677.05]], formatted: [] } },
};
describe("Apps Script batch adapter", () => {
  it("HOLDINGS batch produces AUM £1,462,880", () => {
    expect(Math.round(parseHoldingsCashBlock(sheetGrid(batch.ranges.HOLDINGS_CASH)).aum ?? 0)).toBe(1462880);
  });
  it("HOLDINGS batch preserves F58 gross DP 11.39%", () => {
    expect(((parseHoldingsCashBlock(sheetGrid(batch.ranges.HOLDINGS_CASH)).grossDp ?? 0) * 100).toFixed(2)).toBe("11.39");
  });
  it("only SCORES quartet rescues formatted values", () => {
    const r = { range: "SCORES!A1:C2", values: [["Ticker", "Bull Base", "Current Price"], ["TEST", null, null]], formatted: [["Ticker", "Bull Base", "Current Price"], ["TEST", "165", "£100"]] };
    expect(sheetObjectRows("SCORES", r)[0]).toEqual({ ticker: "TEST", bull_base: "165", "current price": null });
    expect(sheetObjectRows("WATCHLIST", r)[0].bull_base).toBeNull();
  });
  it("LAYERS row 2 remains data", () => {
    const rows = sheetObjectRows("LAYERS", { range: "LAYERS!A2:H11", values: [["Core", 1, 0.2, 0.19, 100]], formatted: [] });
    expect(rows[0].layer).toBe("Core");
    expect(rows[0]["target %"]).toBe(0.2);
  });
});
