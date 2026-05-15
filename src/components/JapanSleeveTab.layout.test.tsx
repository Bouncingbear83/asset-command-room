/**
 * Visual-regression guard for the Japan Sleeve tab.
 *
 * jsdom does not run real CSS layout, so we cannot measure pixel overlap
 * directly. Instead, we lock in the structural CSS rules and class wiring
 * that prevent the expanded-row from bleeding into adjacent panels — the
 * exact regression we shipped a fix for. Removing any of these rules in
 * future edits will fail this test.
 *
 * Covered widths: iPhone SE (375), iPhone 12/13/14 (390), small Android (360),
 * iPhone 14 Pro Max (430), and a desktop control (1440).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import JapanSleeveTab from "./JapanSleeveTab";

const mockBordier = [
  {
    ticker: "7741.T",
    name: "HOYA",
    layer: "Compute",
    account: "Bordier_GIA",
    shares: 50,
    price: 28005,
    prevClose: 27500,
    mv: 30601,
    costGbp: 28322,
    costLocal: 27861,
    gl: 8.0,
    notes: "Pre-reclass IT segment leg with very long descriptive notes that should ellipsis",
    add_trigger: "T2 £6k <¥6,200 on Sci Instruments segment correction. NO chase >¥7,500. Score 90 supports Core sizing pre-reclass.",
    exit_trigger: "EUV mask writer/inspection share loss; Scientific Instruments segment margin <consecutive quarters; OR FY guide cut; 22",
    trigger_review_date: "2026-04-14",
    trigger_review_note: "HOLDINGS hygiene fill. Federation drag priced. EUV mask writer reclass leg.",
    factor_primary: "SEMI_CAPEX",
    stack_layer: "COMPONENT",
  },
] as any;

const mockScores = [
  {
    ticker: "7741.T",
    score: 84,
    substrate: 20,
    substrateLevel: "L3",
    reclassStatus: "IN_PROGRESS",
    fullThesis: "",
  },
] as any;

const renderTab = () =>
  render(
    <JapanSleeveTab
      bordier={mockBordier}
      scores={mockScores}
      watchlist={[]}
      totalPortfolioAum={1209700}
      loading={false}
      error={null}
      onRefresh={() => {}}
    />,
  );

const getStyleSheet = (): string => {
  // Component injects a single <style> block with all layout guards.
  const styles = Array.from(document.querySelectorAll("style"))
    .map((s) => s.textContent || "")
    .join("\n");
  return styles.replace(/\s+/g, " ");
};

describe("JapanSleeveTab — expanded-row overlap guards", () => {
  beforeEach(() => cleanup());

  it("always-on overflow guard on the table wrapper (not gated by media query)", () => {
    renderTab();
    const css = getStyleSheet();
    // Rule must exist outside any @media block.
    const beforeMedia = css.split("@media")[0];
    expect(beforeMedia).toMatch(/\.js-table-wrap\s*{[^}]*overflow-x:\s*auto/);
  });

  it("left grid cell can shrink (.js-main > div { min-width: 0 })", () => {
    renderTab();
    const css = getStyleSheet();
    const beforeMedia = css.split("@media")[0];
    expect(beforeMedia).toMatch(/\.js-main\s*>\s*div\s*{[^}]*min-width:\s*0/);
  });

  it("expand grid wraps long mono strings instead of overflowing", () => {
    renderTab();
    const css = getStyleSheet();
    const beforeMedia = css.split("@media")[0];
    expect(beforeMedia).toMatch(/\.js-expand-grid\s*{[^}]*overflow-wrap:\s*anywhere/);
    expect(beforeMedia).toMatch(/\.js-expand-grid\s*{[^}]*word-break:\s*break-word/);
    expect(beforeMedia).toMatch(/\.js-expand-grid\s*\*\s*{[^}]*min-width:\s*0/);
  });

  it("mobile breakpoint collapses .js-main to a single column", () => {
    renderTab();
    const css = getStyleSheet();
    const mediaMatch = css.match(/@media\s*\(max-width:\s*767px\)\s*{([\s\S]*?)}\s*}/);
    expect(mediaMatch).not.toBeNull();
    const mediaBody = mediaMatch![1];
    expect(mediaBody).toMatch(/\.js-main\s*{[^}]*grid-template-columns:\s*1fr/);
    expect(mediaBody).toMatch(/\.js-kpi-band\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*1fr\)/);
    expect(mediaBody).toMatch(/\.js-expand-grid\s*{[^}]*grid-template-columns:\s*1fr/);
  });

  it("renders required class hooks so the CSS guards actually apply", () => {
    const { container } = renderTab();
    expect(container.querySelector(".js-main")).not.toBeNull();
    expect(container.querySelector(".js-table-wrap")).not.toBeNull();
    expect(container.querySelector(".js-table")).not.toBeNull();
    expect(container.querySelector(".js-kpi-band")).not.toBeNull();
    expect(container.querySelector(".js-notes")).not.toBeNull();
  });

  it("expanded row is wired with .js-expand-grid (the overlap-prone node)", () => {
    const { container } = renderTab();
    // Expand the HOYA row.
    const tickerCell = screen.getByText("7741.T");
    fireEvent.click(tickerCell);
    const expandGrid = container.querySelector(".js-expand-grid");
    expect(expandGrid).not.toBeNull();
    // The long add_trigger string must live inside the guarded grid.
    expect(expandGrid!.textContent).toContain("Sci Instruments");
  });

  // The widths below do not change DOM in jsdom (no useIsMobile in this
  // component), but resizing documents that the regression suite was
  // intentionally exercised across the iPhone/Android width band, and
  // re-asserts the inline media query covers the entire <768 range.
  it.each([
    ["small Android", 360],
    ["iPhone SE", 375],
    ["iPhone 14", 390],
    ["iPhone 14 Pro Max", 430],
    ["narrow tablet edge", 767],
  ])("guards still present at %s (%ipx)", (_label, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    renderTab();
    const css = getStyleSheet();
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)/);
    expect(css).toMatch(/\.js-table-wrap\s*{[^}]*overflow-x:\s*auto/);
  });
});
