import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { SIPP_HOLDINGS, ISA_HOLDINGS } from "@/data/portfolio";
import { LiveHolding } from "@/hooks/usePortfolioData";

interface Props {
  sipp: LiveHolding[];
  isa: LiveHolding[];
}

type ViewMode = "layer" | "account" | "pricemap";

const ACTION_STYLE: Record<string, React.CSSProperties> = {
  HOLD: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  ADD: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  "SIZE UP": { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  MONITOR: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  REVIEW: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  TRIM: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  EXIT: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  SELL: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  CAP: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  WATCH: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
};

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 24 };
const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 20px",
  borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  color: "var(--text-mid)",
};

const detailRowS: React.CSSProperties = {
  padding: "6px 12px 6px 36px",
  fontFamily: "'DM Mono', var(--font-mono)",
  fontSize: "0.78rem",
  background: "color-mix(in srgb, var(--panel) 90%, white 10%)",
  borderBottom: "1px solid rgba(28,28,48,0.25)",
};

type SortKey = "ticker" | "name" | "layer" | "mv" | "gl" | "day" | "price" | "action";
type SortDir = "asc" | "desc";

const COLUMNS: { label: string; key: SortKey; align?: "right" }[] = [
  { label: "Ticker", key: "ticker" },
  { label: "Name", key: "name" },
  { label: "Layer", key: "layer" },
  { label: "MV £", key: "mv", align: "right" },
  { label: "G/L %", key: "gl", align: "right" },
  { label: "Day %", key: "day", align: "right" },
  { label: "Price", key: "price", align: "right" },
];

function sortHoldings(data: LiveHolding[], key: SortKey, dir: SortDir): LiveHolding[] {
  return [...data].sort((a, b) => {
    const av = a[key] ?? "";
    const bv = b[key] ?? "";
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
}

function InlineRangeBar({ h }: { h: LiveHolding }) {
  if (h.ma60 == null || h.high_52w == null || h.low_52w == null || h.price == null) return null;
  const low = h.low_52w;
  const high = h.high_52w;
  const price = h.price;
  const ma60 = h.ma60;
  const range = high - low;
  if (range <= 0) return null;

  const pricePct = Math.max(0, Math.min(100, ((price - low) / range) * 100));
  const ma60Pct = Math.max(0, Math.min(100, ((ma60 - low) / range) * 100));
  const distFromMa = ((price - ma60) / ma60) * 100;

  let statusColor: string;
  let statusLabel: string;
  if (price > ma60 * 1.10) { statusColor = "var(--amber)"; statusLabel = "Extended"; }
  else if (price < ma60 * 0.90) { statusColor = "var(--red)"; statusLabel = "Under pressure"; }
  else { statusColor = "var(--green)"; statusLabel = "On trend"; }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
      {/* Range bar */}
      <div style={{ flex: 1, position: "relative", height: 22, display: "flex", alignItems: "center", minWidth: 120 }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 6, background: "rgba(110,142,200,0.25)", borderRadius: 3 }} />
        <div style={{ position: "absolute", left: `${ma60Pct}%`, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 7, color: "var(--gold)", whiteSpace: "nowrap", marginBottom: 1 }}>MA60</span>
          <div style={{ width: 0, flex: 1, borderLeft: "1px dashed var(--gold)" }} />
        </div>
        <div style={{ position: "absolute", left: `${pricePct}%`, top: 3, bottom: 2, width: 2, background: statusColor, borderRadius: 1 }} />
        <span style={{ position: "absolute", left: 0, bottom: -1, fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)" }}>{low.toFixed(0)}</span>
        <span style={{ position: "absolute", right: 0, bottom: -1, fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)" }}>{high.toFixed(0)}</span>
      </div>
      {/* Status + distance */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{
          background: statusColor === "var(--green)" ? "var(--green-dim)" : statusColor === "var(--amber)" ? "var(--amber-dim)" : "var(--red-dim)",
          color: statusColor,
          border: `1px solid ${statusColor === "var(--green)" ? "rgba(90,191,160,0.2)" : statusColor === "var(--amber)" ? "rgba(200,146,90,0.2)" : "rgba(200,90,90,0.2)"}`,
          padding: "1px 6px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em", whiteSpace: "nowrap",
        }}>
          {statusLabel}
        </span>
        <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 10, color: statusColor, whiteSpace: "nowrap" }}>
          {distFromMa >= 0 ? "+" : ""}{distFromMa.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function TriggerRows({ h, colSpan }: { h: LiveHolding; colSpan: number }) {
  const addVal = h.add_trigger || "—";
  const exitVal = h.exit_trigger || "—";
  const has52w = h.ma60 != null && h.high_52w != null && h.low_52w != null && h.price != null;
  return (
    <>
      <tr>
        <td colSpan={colSpan} style={detailRowS}>
          <span style={{ color: "var(--green)", fontWeight: 700, marginRight: 10, fontSize: 9, letterSpacing: "0.1em" }}>ADD</span>
          <span style={{ color: "var(--text-mid)" }}>{addVal}</span>
        </td>
      </tr>
      <tr>
        <td colSpan={colSpan} style={detailRowS}>
          <span style={{ color: "var(--red)", fontWeight: 700, marginRight: 10, fontSize: 9, letterSpacing: "0.1em" }}>EXIT</span>
          <span style={{ color: "var(--text-mid)" }}>{exitVal}</span>
        </td>
      </tr>
      {has52w && (
        <tr>
          <td colSpan={colSpan} style={detailRowS}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 9, letterSpacing: "0.1em", flexShrink: 0 }}>52W</span>
              <InlineRangeBar h={h} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function HoldingsTable({ holdings }: { holdings: LiveHolding[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("mv");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = sortHoldings(holdings, sortKey, sortDir);
  const total = holdings.reduce((s, h) => s + (h.mv || 0), 0);
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const totalCols = COLUMNS.length + 2; // +Notes +Action

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                style={{
                  fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase",
                  color: sortKey === col.key ? "var(--gold)" : "var(--text-dim)",
                  padding: "8px 12px", borderBottom: "1px solid var(--rim)",
                  textAlign: col.align ?? "left", fontWeight: 400, whiteSpace: "nowrap",
                  cursor: "pointer", userSelect: "none",
                }}
              >
                {col.label}{arrow(col.key)}
              </th>
            ))}
            <th style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", padding: "8px 12px", borderBottom: "1px solid var(--rim)", textAlign: "left", fontWeight: 400 }}>Notes</th>
            <th style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", padding: "8px 12px", borderBottom: "1px solid var(--rim)", textAlign: "left", fontWeight: 400 }}>Action</th>
            <th style={{ width: 24, padding: "8px 6px", borderBottom: "1px solid var(--rim)" }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => {
            const isOpen = expanded.has(h.ticker);
            return (
              <>
                <tr
                  key={h.ticker}
                  onClick={() => toggle(h.ticker)}
                  style={{ borderBottom: isOpen ? "none" : "1px solid rgba(28,28,48,0.4)", cursor: "pointer" }}
                >
                  <td style={{ padding: "10px 12px", color: "var(--gold)", fontWeight: 700 }}>{h.ticker}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text)", whiteSpace: "nowrap" }}>{h.name}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text-dim)", fontSize: 10 }}>{h.layer}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text)", textAlign: "right", whiteSpace: "nowrap" }}>
                    {h.mv ? `£${h.mv.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: h.gl >= 0 ? "var(--green)" : "var(--red)", textAlign: "right" }}>
                    {h.gl != null ? `${h.gl >= 0 ? "+" : ""}${h.gl.toFixed(1)}%` : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: h.day > 0 ? "var(--green)" : h.day < 0 ? "var(--red)" : "var(--text-dim)", textAlign: "right" }}>
                    {h.day != null ? `${h.day >= 0 ? "+" : ""}${h.day.toFixed(2)}%` : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-mid)", textAlign: "right" }}>
                    {h.price != null ? `${h.price.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${h.currency}` : "—"}
                  </td>
                  <td style={{
                    padding: "10px 12px", color: "var(--text-dim)", fontSize: 10, maxWidth: 260,
                    overflow: "hidden", textOverflow: isOpen ? "unset" : "ellipsis",
                    whiteSpace: isOpen ? "normal" : "nowrap", lineHeight: 1.5,
                  }}>
                    {h.notes}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ ...(ACTION_STYLE[h.action] ?? ACTION_STYLE.MONITOR), fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", padding: "2px 8px", borderRadius: 2, whiteSpace: "nowrap" }}>
                      {h.action}
                    </span>
                  </td>
                  <td style={{ padding: "10px 6px", color: "var(--text-dim)" }}>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                </tr>
                {isOpen && <TriggerRows h={h} colSpan={totalCols + 1} />}
              </>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} style={{ padding: "12px", color: "var(--text-mid)", fontWeight: 700, borderTop: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>TOTAL</td>
            <td style={{ padding: "12px", color: "var(--gold)", fontWeight: 700, textAlign: "right", borderTop: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              £{total.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            </td>
            <td colSpan={totalCols - 3} style={{ borderTop: "1px solid var(--rim)" }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ToggleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
        padding: "4px 12px", border: "1px solid var(--rim)",
        background: active ? "var(--accent-dim)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-dim)",
        cursor: "pointer", transition: "all 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}

interface LayerGroup {
  layer: string;
  holdings: LiveHolding[];
  totalMv: number;
  pctAum: number;
}

function LayerView({ allHoldings, totalAum }: { allHoldings: LiveHolding[]; totalAum: number }) {
  const grouped = new Map<string, LiveHolding[]>();
  for (const h of allHoldings) {
    const key = h.layer || "Uncategorised";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(h);
  }

  const layers: LayerGroup[] = Array.from(grouped.entries())
    .map(([layer, holdings]) => {
      const totalMv = holdings.reduce((s, h) => s + (h.mv || 0), 0);
      return { layer, holdings, totalMv, pctAum: totalAum > 0 ? (totalMv / totalAum) * 100 : 0 };
    })
    .sort((a, b) => b.totalMv - a.totalMv);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleRow = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const thS: React.CSSProperties = {
    fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)",
    padding: "8px 12px", borderBottom: "1px solid var(--rim)", textAlign: "left", fontWeight: 400, whiteSpace: "nowrap",
  };

  const totalCols = 9; // all columns including chevron

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <thead>
          <tr>
            <th style={thS}>Ticker</th>
            <th style={thS}>Name</th>
            <th style={{ ...thS, textAlign: "right" }}>MV £</th>
            <th style={{ ...thS, textAlign: "right" }}>G/L %</th>
            <th style={{ ...thS, textAlign: "right" }}>Day %</th>
            <th style={{ ...thS, textAlign: "right" }}>Price</th>
            <th style={thS}>Notes</th>
            <th style={thS}>Action</th>
            <th style={{ width: 24, padding: "8px 6px", borderBottom: "1px solid var(--rim)" }} />
          </tr>
        </thead>
        <tbody>
          {layers.map((lg) => (
            <>
              {/* Layer header row */}
              <tr key={`layer-${lg.layer}`} style={{ background: "rgba(28,28,48,0.6)" }}>
                <td colSpan={2} style={{ padding: "10px 12px", color: "var(--gold)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {lg.layer}
                  <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: 9, marginLeft: 8 }}>
                    {lg.holdings.length} holding{lg.holdings.length !== 1 ? "s" : ""}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text)", fontWeight: 700 }}>
                  £{lg.totalMv.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--accent)", fontWeight: 700, fontSize: 10 }}>
                  {lg.pctAum.toFixed(1)}% AUM
                </td>
                <td colSpan={5} />
              </tr>
              {/* Holdings within layer */}
              {[...lg.holdings].sort((a, b) => (b.mv || 0) - (a.mv || 0)).map((h) => {
                const isOpen = expanded.has(h.ticker);
                return (
                  <>
                    <tr
                      key={h.ticker}
                      onClick={() => toggleRow(h.ticker)}
                      style={{ borderBottom: isOpen ? "none" : "1px solid rgba(28,28,48,0.3)", cursor: "pointer" }}
                    >
                      <td style={{ padding: "10px 12px 10px 24px", color: "var(--gold)", fontWeight: 700 }}>{h.ticker}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text)", whiteSpace: "nowrap" }}>{h.name}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text)", textAlign: "right", whiteSpace: "nowrap" }}>
                        {h.mv ? `£${h.mv.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: h.gl >= 0 ? "var(--green)" : "var(--red)", textAlign: "right" }}>
                        {h.gl != null ? `${h.gl >= 0 ? "+" : ""}${h.gl.toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: h.day > 0 ? "var(--green)" : h.day < 0 ? "var(--red)" : "var(--text-dim)", textAlign: "right" }}>
                        {h.day != null ? `${h.day >= 0 ? "+" : ""}${h.day.toFixed(2)}%` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-mid)", textAlign: "right" }}>
                        {h.price != null ? `${h.price.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${h.currency}` : "—"}
                      </td>
                      <td style={{
                        padding: "10px 12px", color: "var(--text-dim)", fontSize: 10, maxWidth: 260,
                        overflow: "hidden", textOverflow: isOpen ? "unset" : "ellipsis",
                        whiteSpace: isOpen ? "normal" : "nowrap", lineHeight: 1.5,
                      }}>
                        {h.notes}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ ...(ACTION_STYLE[h.action] ?? ACTION_STYLE.MONITOR), fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", padding: "2px 8px", borderRadius: 2, whiteSpace: "nowrap" }}>
                          {h.action}
                        </span>
                      </td>
                      <td style={{ padding: "10px 6px", color: "var(--text-dim)" }}>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                    </tr>
                    {isOpen && <TriggerRows h={h} colSpan={totalCols} />}
                  </>
                );
              })}
            </>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} style={{ padding: "12px", color: "var(--text-mid)", fontWeight: 700, borderTop: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>TOTAL</td>
            <td style={{ padding: "12px", color: "var(--gold)", fontWeight: 700, textAlign: "right", borderTop: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              £{totalAum.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            </td>
            <td colSpan={totalCols - 2} style={{ borderTop: "1px solid var(--rim)" }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

type PriceMapSort = "ma_dist" | "pct_above_low" | "pct_below_high";

function getPriceMapSortValue(h: LiveHolding, sort: PriceMapSort): number {
  const price = h.price!;
  const low = h.low_52w!;
  const high = h.high_52w!;
  const ma60 = h.ma60!;
  switch (sort) {
    case "pct_above_low": return ((price - low) / low) * 100;
    case "pct_below_high": return ((high - price) / high) * 100;
    case "ma_dist": return Math.abs(((price - ma60) / ma60) * 100);
  }
}

function PriceMapView({ allHoldings }: { allHoldings: LiveHolding[] }) {
  const [sortMode, setSortMode] = useState<PriceMapSort>("ma_dist");

  // Deduplicate by ticker, prefer the one with more data
  const deduped = new Map<string, LiveHolding>();
  for (const h of allHoldings) {
    if (!deduped.has(h.ticker) || (h.ma60 && !deduped.get(h.ticker)!.ma60)) {
      deduped.set(h.ticker, h);
    }
  }

  // Filter valid rows
  const valid = Array.from(deduped.values()).filter(
    (h) => h.ma60 && h.high_52w && h.low_52w && h.price != null
  );

  // Group by layer
  const grouped = new Map<string, LiveHolding[]>();
  for (const h of valid) {
    const key = h.layer || "Uncategorised";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(h);
  }
  const layers = Array.from(grouped.entries()).sort((a, b) => {
    const mvA = a[1].reduce((s, h) => s + (h.mv || 0), 0);
    const mvB = b[1].reduce((s, h) => s + (h.mv || 0), 0);
    return mvB - mvA;
  });

  if (valid.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
        No price map data — populate MA60, HIGH_52w, LOW_52w columns in holdings sheets.
      </div>
    );
  }

  const SORT_OPTIONS: { key: PriceMapSort; label: string }[] = [
    { key: "ma_dist", label: "60d MA Dist" },
    { key: "pct_above_low", label: "% Above 52W Low" },
    { key: "pct_below_high", label: "% Below 52W High" },
  ];

  return (
    <div style={{ padding: "12px 20px" }}>
      {/* Sort controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", marginRight: 4 }}>Sort</span>
        {SORT_OPTIONS.map((opt) => (
          <ToggleButton key={opt.key} active={sortMode === opt.key} label={opt.label} onClick={() => setSortMode(opt.key)} />
        ))}
      </div>
      {layers.map(([layer, holdings]) => {
        const sorted = [...holdings].sort((a, b) => getPriceMapSortValue(a, sortMode) - getPriceMapSortValue(b, sortMode));
        return (
          <div key={layer} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)", padding: "8px 0", borderBottom: "1px solid var(--rim)", marginBottom: 8 }}>
              {layer}
            </div>
            {sorted.map((h) => {
              const low = h.low_52w!;
              const high = h.high_52w!;
              const price = h.price!;
              const ma60 = h.ma60!;
              const range = high - low;
              if (range <= 0) return null;

              const pricePct = Math.max(0, Math.min(100, ((price - low) / range) * 100));
              const ma60Pct = Math.max(0, Math.min(100, ((ma60 - low) / range) * 100));
              const distFromMa = ((price - ma60) / ma60) * 100;
              const sortVal = getPriceMapSortValue(h, sortMode);

              let statusColor: string;
              let statusLabel: string;
              if (price > ma60 * 1.10) { statusColor = "var(--amber)"; statusLabel = "Extended"; }
              else if (price < ma60 * 0.90) { statusColor = "var(--red)"; statusLabel = "Under pressure"; }
              else { statusColor = "var(--green)"; statusLabel = "On trend"; }

              return (
                <div key={h.ticker} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(28,28,48,0.25)" }}>
                  {/* Left: ticker + name */}
                  <div style={{ width: 120, flexShrink: 0 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>{h.ticker}</span>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
                  </div>

                  {/* Centre: range bar */}
                  <div style={{ flex: 1, position: "relative", height: 28, display: "flex", alignItems: "center" }}>
                    <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: "var(--muted)", borderRadius: 1 }} />
                    <div style={{ position: "absolute", left: `${ma60Pct}%`, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 7, color: "var(--gold)", whiteSpace: "nowrap", marginBottom: 1 }}>MA60</span>
                      <div style={{ width: 0, flex: 1, borderLeft: "1px dashed var(--gold)" }} />
                    </div>
                    <div style={{ position: "absolute", left: `${pricePct}%`, top: 4, bottom: 2, width: 2, background: statusColor, borderRadius: 1 }} />
                    <span style={{ position: "absolute", left: 0, bottom: -2, fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)" }}>{low.toFixed(0)}</span>
                    <span style={{ position: "absolute", right: 0, bottom: -2, fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)" }}>{high.toFixed(0)}</span>
                  </div>

                  {/* Right: price */}
                  <div style={{ width: 80, flexShrink: 0, textAlign: "right" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>{price.toFixed(2)}</span>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>{h.currency}</div>
                  </div>

                  {/* Status chip + distance */}
                  <div style={{ width: 140, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      background: statusColor === "var(--green)" ? "var(--green-dim)" : statusColor === "var(--amber)" ? "var(--amber-dim)" : "var(--red-dim)",
                      color: statusColor,
                      border: `1px solid ${statusColor === "var(--green)" ? "rgba(90,191,160,0.2)" : statusColor === "var(--amber)" ? "rgba(200,146,90,0.2)" : "rgba(200,90,90,0.2)"}`,
                      padding: "1px 6px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em", whiteSpace: "nowrap",
                    }}>
                      {statusLabel}
                    </span>
                    <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 10, color: statusColor, whiteSpace: "nowrap" }}>
                      {distFromMa >= 0 ? "+" : ""}{distFromMa.toFixed(1)}%
                    </span>
                    <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 8, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                      ({sortVal.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function HoldingsTab({ sipp, isa }: Props) {
  const [view, setView] = useState<ViewMode>("layer");

  const sippData: LiveHolding[] =
    sipp.length > 0
      ? sipp
      : SIPP_HOLDINGS.map((h) => ({ ...h, day: 0, price: 0, prevClose: 0, currency: "USD", costGbp: 0, shares: 0, add_trigger: "", exit_trigger: "", ma60: null, high_52w: null, low_52w: null }));
  const isaData: LiveHolding[] =
    isa.length > 0
      ? isa
      : ISA_HOLDINGS.map((h) => ({ ...h, day: 0, price: 0, prevClose: 0, currency: "USD", costGbp: 0, shares: 0, add_trigger: "", exit_trigger: "", ma60: null, high_52w: null, low_52w: null }));

  const allHoldings = [...sippData, ...isaData];
  const totalAum = allHoldings.reduce((s, h) => s + (h.mv || 0), 0);
  const sippTotal = sippData.reduce((s, h) => s + (h.mv || 0), 0);
  const isaTotal = isaData.reduce((s, h) => s + (h.mv || 0), 0);

  return (
    <div>
      {/* View toggle header */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={cardHeader}>
          <span style={cardTitle}>Holdings</span>
          <div style={{ display: "flex", gap: 0 }}>
            <ToggleButton active={view === "layer"} label="By Layer" onClick={() => setView("layer")} />
            <ToggleButton active={view === "account"} label="By Account" onClick={() => setView("account")} />
            <ToggleButton active={view === "pricemap"} label="Price Map" onClick={() => setView("pricemap")} />
          </div>
        </div>

        {view === "layer" && <LayerView allHoldings={allHoldings} totalAum={totalAum} />}
        {view === "pricemap" && <PriceMapView allHoldings={allHoldings} />}
      </div>

      {view === "account" && (
        <>
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>SIPP Holdings</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)" }}>
                £{sippTotal.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                <span style={{ color: "var(--text-dim)", fontSize: 10 }}> · long horizon</span>
              </span>
            </div>
            <HoldingsTable holdings={sippData} />
          </div>
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>ISA Holdings</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)" }}>
                £{isaTotal.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                <span style={{ color: "var(--text-dim)", fontSize: 10 }}> · flexible wrapper</span>
              </span>
            </div>
            <HoldingsTable holdings={isaData} />
          </div>
        </>
      )}
    </div>
  );
}
