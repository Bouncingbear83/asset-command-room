import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

// A bare `{x.ticker}` used as JSX text (not an attribute, template literal, or TickerLabel prop).
const BARE = /(?<![$=])\{[A-Za-z_][\w.?!]*\.ticker\}/;
const ALLOW = ["TickerLabel.tsx", "WatchlistDebugTable.tsx"]; // debug-only table behind ?debug=1

describe("ticker render guard", () => {
  it("no component renders a bare .ticker outside TickerLabel", () => {
    const files = [...walk("src/components"), ...walk("src/pages")].filter((f) => !ALLOW.some((a) => f.endsWith(a)) && !f.endsWith(".test.tsx"));
    const hits: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (BARE.test(line.replace(/key=\{[^}]*\}/g, ""))) hits.push(`${f}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
