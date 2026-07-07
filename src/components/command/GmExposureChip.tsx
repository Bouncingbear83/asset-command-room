/**
 * GmExposureChip — shows G(m) micro-cap aggregate exposure.
 *
 * OB v3.13 §11.10a caps:
 *   Single name:  1% AUM
 *   Aggregate:    2.5% AUM
 *   Max positions: 4
 *
 * Detection: delegates to shared buildFrameworkIndex utility.
 * Clickable — opens a drill-through popover listing deployed + staged names.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { LiveScore, LiveHolding, LiveWatchItem } from "@/hooks/usePortfolioData";
import { buildFrameworkIndex } from "@/utils/frameworkDetection";
import TickerButton from "@/components/factsheet/TickerButton";

interface Props {
  scores: LiveScore[];
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
}

const GM_MAX_POSITIONS = 4;
const GM_MAX_AGGREGATE_PCT = 2.5;
const GM_MAX_SINGLE_PCT = 1.0;

interface RowInfo {
  ticker: string;
  score: number | null;
  status: string;
  aum_pct: number | null;
  entry: string;
}

export default function GmExposureChip({ scores, holdings, watchlist }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const frameworkIndex = useMemo(
    () => buildFrameworkIndex(scores, watchlist),
    [scores, watchlist],
  );

  const scoreByTicker = useMemo(() => {
    const m = new Map<string, LiveScore>();
    for (const s of scores) {
      const t = s.ticker.trim().toUpperCase();
      if (t) m.set(t, s);
    }
    return m;
  }, [scores]);

  const watchByTicker = useMemo(() => {
    const m = new Map<string, LiveWatchItem>();
    for (const w of watchlist) {
      const t = w.ticker.trim().toUpperCase();
      if (t) m.set(t, w);
    }
    return m;
  }, [watchlist]);

  const holdingByTicker = useMemo(() => {
    const m = new Map<string, LiveHolding>();
    for (const h of holdings) {
      const t = h.ticker.trim().toUpperCase();
      if (t) m.set(t, h);
    }
    return m;
  }, [holdings]);

  const { allGm, deployed, staged } = useMemo(() => {
    const gm: string[] = [];
    for (const [t, entry] of frameworkIndex.entries()) {
      if (entry.framework === "G(m)") gm.push(t);
    }
    const dep: RowInfo[] = [];
    const stg: RowInfo[] = [];
    for (const t of gm) {
      const s = scoreByTicker.get(t) ?? null;
      const w = watchByTicker.get(t) ?? null;
      const h = holdingByTicker.get(t) ?? null;
      const isHeld = s && s.heldStatus.toUpperCase() === "HELD" && !!h;
      const row: RowInfo = {
        ticker: t,
        score: s?.score ?? null,
        status: (s?.heldStatus || w?.status || "").toUpperCase(),
        aum_pct: h?.aum_pct ?? null,
        entry: w?.entry ?? "",
      };
      if (isHeld) dep.push(row);
      else stg.push(row);
    }
    dep.sort((a, b) => (b.aum_pct ?? 0) - (a.aum_pct ?? 0));
    stg.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
    return { allGm: gm, deployed: dep, staged: stg };
  }, [frameworkIndex, scoreByTicker, watchByTicker, holdingByTicker]);

  const deployedCount = deployed.length;
  const aggregateAum = deployed.reduce((sum, h) => sum + (h.aum_pct ?? 0), 0);
  const stagedCount = staged.length;

  const countBreach = deployedCount > GM_MAX_POSITIONS;
  const aggBreach = aggregateAum > GM_MAX_AGGREGATE_PCT;
  const singleBreach = deployed.some((h) => (h.aum_pct ?? 0) > GM_MAX_SINGLE_PCT);
  const anyBreach = countBreach || aggBreach || singleBreach;
  const anyWarn =
    !anyBreach &&
    (deployedCount >= GM_MAX_POSITIONS || aggregateAum > GM_MAX_AGGREGATE_PCT * 0.8);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (allGm.length === 0) return null;

  const borderColor = anyBreach
    ? "rgba(239,68,68,0.4)"
    : anyWarn
    ? "rgba(245,158,11,0.4)"
    : "var(--rim)";
  const bgColor = anyBreach
    ? "rgba(239,68,68,0.06)"
    : anyWarn
    ? "rgba(245,158,11,0.06)"
    : "var(--panel)";

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="G(m) exposure — click for details"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          border: `1px solid ${borderColor}`,
          background: bgColor,
          borderRadius: 2,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.08em",
          cursor: "pointer",
          color: "inherit",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--gold)",
            letterSpacing: "0.12em",
          }}
        >
          G(m)
        </span>

        <span style={{ color: "var(--text)" }}>
          {deployedCount}/{GM_MAX_POSITIONS} deployed
        </span>

        <span
          style={{
            color: aggBreach ? "var(--red)" : anyWarn ? "var(--amber)" : "var(--text-dim)",
          }}
        >
          {aggregateAum.toFixed(1)}%/{GM_MAX_AGGREGATE_PCT}% AUM
        </span>

        {stagedCount > 0 && (
          <span style={{ color: "var(--text-dim)" }}>{stagedCount} staged</span>
        )}

        {singleBreach && (
          <span
            style={{
              color: "var(--red)",
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            1% breach
          </span>
        )}

        <span style={{ color: "var(--text-dim)", fontSize: 9, marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 40,
            background: "var(--panel)",
            border: "1px solid var(--rim)",
            borderRadius: 2,
            minWidth: 360,
            padding: "10px 12px",
            fontFamily: "var(--font-mono)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          <PopoverSection
            title={`DEPLOYED · ${deployedCount}`}
            rows={deployed}
            variant="deployed"
          />
          <div style={{ height: 10 }} />
          <PopoverSection
            title={`STAGED · ${stagedCount}`}
            rows={staged}
            variant="staged"
          />
        </div>
      )}
    </div>
  );
}

function PopoverSection({
  title,
  rows,
  variant,
}: {
  title: string;
  rows: RowInfo[];
  variant: "deployed" | "staged";
}) {
  const leftBorder = variant === "deployed" ? "var(--green)" : "var(--rim)";
  const lastColLabel = variant === "deployed" ? "AUM%" : "Entry";

  return (
    <div>
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.15em",
          color: "var(--gold)",
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "70px 44px 1fr 90px",
          gap: 6,
          fontSize: 9,
          letterSpacing: "0.1em",
          color: "var(--text-mid)",
          textTransform: "uppercase",
          padding: "0 6px 4px 8px",
          borderBottom: "1px solid var(--rim)",
        }}
      >
        <span>Ticker</span>
        <span style={{ textAlign: "right" }}>Score</span>
        <span>Status</span>
        <span style={{ textAlign: "right" }}>{lastColLabel}</span>
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            fontSize: 9,
            color: "var(--text-dim)",
            padding: "8px 6px",
            letterSpacing: "0.08em",
          }}
        >
          — none —
        </div>
      ) : (
        rows.map((r) => (
          <div
            key={r.ticker}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 44px 1fr 90px",
              gap: 6,
              alignItems: "center",
              fontSize: 10,
              color: "var(--text)",
              padding: "4px 6px 4px 8px",
              borderLeft: `2px solid ${leftBorder}`,
              borderBottom: "1px solid rgba(28,28,48,0.4)",
            }}
          >
            <TickerButton
              ticker={r.ticker}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              {r.ticker}
            </TickerButton>
            <span style={{ textAlign: "right", color: "var(--text-dim)" }}>
              {r.score != null ? r.score.toFixed(1) : "—"}
            </span>
            <span
              style={{
                color: "var(--text-dim)",
                fontSize: 9,
                letterSpacing: "0.08em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {r.status || "—"}
            </span>
            <span
              style={{
                textAlign: "right",
                color: variant === "deployed" ? "var(--text)" : "var(--text-dim)",
              }}
            >
              {variant === "deployed"
                ? r.aum_pct != null
                  ? `${r.aum_pct.toFixed(2)}%`
                  : "—"
                : r.entry || "—"}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
