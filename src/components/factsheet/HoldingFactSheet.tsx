import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceChart } from "@/components/PriceChart";
import ClaudePromptButton from "@/components/ClaudePromptButton";
import { triggerWebhook } from "@/lib/webhooks";
import { GIDS, type PortfolioData, type LiveHolding } from "@/hooks/usePortfolioData";
import type { PriceDataMap } from "@/hooks/useDailyPrices";
import { useFactSheetData, type FactSheetData } from "./useFactSheetData";

interface Props {
  ticker: string | null;
  portfolio: PortfolioData;
  priceData: PriceDataMap;
  onClose: () => void;
}

const SHEET_BASE = "https://docs.google.com/spreadsheets/d/1T2afEG3mLjxmonduDugHA5SlJ44-RBJmv0bxISfalNo";
const SHEET_SCORES_URL = `${SHEET_BASE}/edit?gid=${GIDS.scores}`;

const monoLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
};

const sectionStyle: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid var(--rim)",
};

const sectionTitle: React.CSSProperties = {
  ...monoLabel,
  marginBottom: 10,
  color: "var(--gold)",
};

function fmtNum(v: number | null | undefined, digits = 2) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  return Number(v).toFixed(digits);
}

function fmtMoney(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  return `£${Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function fmtPct(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  return `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(1)}%`;
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const s = String(d).slice(0, 10);
  return s || "—";
}

// Pick first finite value across an ordered list of candidates.
function pickNum(...vals: Array<number | null | undefined>): number | null {
  for (const v of vals) {
    if (v !== null && v !== undefined && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}
function pickStr(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) {
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v);
  }
  return null;
}

// Resolve a Price Anchor (first_add or last_score) with precedence
// SCORES > HOLDINGS > WATCHLIST > Supabase score_rationales.
function resolveAnchor(
  field: "first_add" | "last_score",
  d: FactSheetData,
): { price: number | null; date: string | null; source: string | null } {
  const s: any = d.score || {};
  const h: any = d.holdings[0] || {};
  const w: any = d.watchlist || {};
  const r: any = d.rationale || {};

  const tryGet = (
    src: string,
    price: unknown,
    date: unknown,
  ): { price: number | null; date: string | null; source: string } | null => {
    const pn = price === null || price === undefined ? null : Number(price);
    const finite = pn !== null && Number.isFinite(pn);
    const dStr = date === null || date === undefined ? null : String(date).slice(0, 10);
    if (!finite && !dStr) return null;
    return { price: finite ? pn : null, date: dStr || null, source: src };
  };

  if (field === "first_add") {
    return (
      tryGet("SCORES", s.priceAtFirstAdd, s.firstAddDate) ||
      tryGet("HOLDINGS", h.priceAtFirstAdd, h.firstAddDate) ||
      tryGet("WATCHLIST", w.priceAtFirstAdd, w.firstAddDate) ||
      tryGet("rationale", r.price_at_first_add, r.first_add_date) ||
      { price: null, date: null, source: null }
    );
  }
  return (
    tryGet("SCORES", s.priceAtLastScore, s.scoreDate) ||
    tryGet("HOLDINGS", h.priceAtLastScore, null) ||
    tryGet("WATCHLIST", w.priceAtLastScore, null) ||
    tryGet("rationale", r.price_at_last_score, r.scored_at) ||
    { price: null, date: null, source: null }
  );
}

function computeBanners(d: FactSheetData) {
  const banners: { tone: "red" | "amber" | "info"; text: string }[] = [];
  const s: any = d.score || {};
  const r: any = d.rationale || {};

  if (String(s.reclassStatus || "").toUpperCase() === "COMPLETE") {
    banners.push({ tone: "amber", text: "Rule #12 — Reclassification complete; valuation premium captured." });
  }
  const factor = String(s.factor_primary || r.factor_primary || "").toUpperCase();
  const china = String(r.china_exposure_flag || "").toUpperCase();
  if (factor === "PROCESS_TOOLING" && china === "HIGH") {
    banners.push({ tone: "red", text: "Rule #14 active — anchor size reduced (PROCESS_TOOLING + China HIGH)." });
  }
  if (d.earnings?.nextEarningsDate) {
    const dd = daysUntil(d.earnings.nextEarningsDate);
    if (dd !== null && dd >= 0 && dd <= 7) {
      banners.push({ tone: "amber", text: `Earnings blackout — ${dd}d to ${d.earnings.fiscalPeriod || "report"}; no rescore.` });
    }
  }
  const subLevel = String(s.substrateLevel || r.substrate_level || "").toUpperCase();
  const stack = String(s.stackLayer || r.stack_layer || "").toUpperCase();
  if (subLevel === "L4" && stack === "COMPONENT") {
    banners.push({ tone: "amber", text: "Audit flag — Substrate L4 + COMPONENT (OB Part 11)." });
  }
  if (String(s.returnProfile || "").toUpperCase() === "PRE_PRODUCTION") {
    banners.push({ tone: "info", text: "Pre-production — substrate −5, anchor only, no staged entry." });
  }
  return banners;
}

function SectionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full mb-2 bg-[hsl(var(--muted))]/30" />
      ))}
    </div>
  );
}

export default function HoldingFactSheet({ ticker, portfolio, priceData, onClose }: Props) {
  const data = useFactSheetData(ticker, portfolio, priceData);
  const [chartRange, setChartRange] = useState<30 | 90 | 180>(90);

  const banners = useMemo(() => computeBanners(data), [data]);

  const isOpen = !!ticker;
  const tkr = data.ticker || ticker || "";
  const display = data.score?.name || data.watchlist?.name || data.holdings[0]?.name || "";
  const layer = data.score?.layer || data.holdings[0]?.layer || data.watchlist?.layer || "";
  const isHeld = data.holdings.length > 0;
  const isWatchlist = !isHeld && !!data.watchlist;

  // Price strip
  const firstHolding: LiveHolding | null = data.holdings[0] || null;
  const livePrice = firstHolding?.price ?? null;
  const latestEod = data.pricePoints.length > 0 ? data.pricePoints[data.pricePoints.length - 1] : null;
  const prevEod = data.pricePoints.length > 1 ? data.pricePoints[data.pricePoints.length - 2] : null;
  const eodPrice = latestEod?.priceLocal ?? null;
  const eodDate = latestEod?.date || null;
  const stripPrice = livePrice ?? eodPrice;
  const isWlPrice = livePrice === null && data.priceSource === "watchlist_history";
  const liveCcy = firstHolding?.currency
    || data.score?.currency
    || (isWlPrice ? (data.priceCurrency || "") : "")
    || "USD";
  const wlDayPct = (isWlPrice && latestEod && prevEod && prevEod.priceLocal)
    ? ((latestEod.priceLocal - prevEod.priceLocal) / prevEod.priceLocal) * 100
    : null;
  const dayPct = firstHolding?.day ?? wlDayPct;
  // Price freshness
  const asOf = livePrice !== null
    ? (portfolio.lastUpdated ? `as of ${portfolio.lastUpdated}` : "live (sheet)")
    : isWlPrice && eodDate
      ? `Watchlist EOD ${eodDate}`
      : (eodDate ? `EOD ${eodDate}` : "no price");
  const isStale = livePrice === null;


  const chartPoints = data.pricePoints.slice(-chartRange);

  // Assemble milestone markers from already-loaded data (no extra fetches).
  const milestones = useMemo(() => {
    const out: Array<{ date: string; kind: "added" | "scored" | "alert" | "earnings"; label: string }> = [];
    const norm = (d: any) => (d ? String(d).slice(0, 10) : "");
    const firstAdd = resolveAnchor("first_add", data);
    if (firstAdd.date) out.push({ date: norm(firstAdd.date), kind: "added", label: `First add${firstAdd.price !== null ? ` @ ${firstAdd.price}` : ""}` });
    for (const h of data.rationaleHistory) {
      const d = norm(h.scored_at);
      if (d) out.push({ date: d, kind: "scored", label: `Score ${h.total_score ?? ""}${h.action ? ` · ${h.action}` : ""}`.trim() });
    }
    for (const h of data.holdings) {
      const d = norm((h as any).alert_fired_date);
      if (d) out.push({ date: d, kind: "alert", label: `Alert ${(h as any).alert_status || "FIRED"}` });
    }
    const e: any = data.earnings;
    const ed = norm(e?.next_earnings_date || e?.date);
    if (ed && ed >= new Date().toISOString().slice(0, 10)) {
      out.push({ date: ed, kind: "earnings", label: `Earnings${e?.fiscal_period ? ` ${e.fiscal_period}` : ""}` });
    }
    return out;
  }, [data]);

  // Defer heavy sections until after the panel shell mounts to keep open snappy.
  const [readyHeavy, setReadyHeavy] = useState(false);
  useEffect(() => {
    if (!isOpen) { setReadyHeavy(false); return; }
    const id = window.setTimeout(() => setReadyHeavy(true), 60);
    return () => window.clearTimeout(id);
  }, [isOpen, ticker]);

  // Close on Esc.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${tkr}${display ? ` — ${display}` : ""} fact sheet`}
      style={{ position: "fixed", inset: 0, zIndex: 1000 }}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }}
      />
      {/* Panel */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(640px, 100%)",
          background: "var(--void)",
          color: "var(--text-mid)",
          borderLeft: "1px solid var(--rim)",
          overflowY: "auto",
          boxShadow: "-10px 0 30px rgba(0,0,0,0.5)",
        }}
      >
        {ticker && (
          <div>
            {/* Sticky header (with close button + swipe-down handle) */}
            <div
              onTouchStart={(e) => {
                (e.currentTarget as any).__sy = e.touches[0]?.clientY ?? 0;
                (e.currentTarget as any).__dy = 0;
              }}
              onTouchMove={(e) => {
                const sy = (e.currentTarget as any).__sy ?? 0;
                (e.currentTarget as any).__dy = (e.touches[0]?.clientY ?? sy) - sy;
              }}
              onTouchEnd={(e) => {
                if (((e.currentTarget as any).__dy ?? 0) > 60) onClose();
              }}
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                background: "var(--void)",
                padding: "10px 14px 12px",
                borderBottom: "1px solid var(--rim)",
              }}
            >
              {/* Mobile swipe handle */}
              <div style={{
                width: 36, height: 3, borderRadius: 2, background: "var(--rim)",
                margin: "0 auto 8px",
              }} />
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--gold)", letterSpacing: "0.04em" }}>{tkr}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16, color: "var(--text-mid)" }}>{display}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>

                {layer && <span style={monoLabel}>{layer}</span>}
                {data.score?.tier && <span style={{ ...monoLabel, color: "var(--silver)" }}>· {data.score.tier}</span>}
                {data.score?.action && <span style={{ ...monoLabel, color: "var(--accent)" }}>· {data.score.action}</span>}
                {isHeld && <span style={{ ...monoLabel, color: "var(--green)" }}>· HELD</span>}
                {isWatchlist && <span style={{ ...monoLabel, color: "var(--accent)" }}>· WATCHLIST</span>}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  style={{
                    flexShrink: 0,
                    background: "transparent", border: "1px solid var(--rim)",
                    color: "var(--text-dim)", fontFamily: "var(--font-mono)",
                    fontSize: 18, lineHeight: 1,
                    minWidth: 40, minHeight: 40,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", borderRadius: 2,
                  }}
                >×</button>
              </div>
            </div>


            {/* Compliance banners */}
            {banners.length > 0 && (
              <div style={{ padding: "8px 18px", borderBottom: "1px solid var(--rim)" }}>
                {banners.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "6px 10px",
                      marginBottom: i < banners.length - 1 ? 6 : 0,
                      borderLeft: `2px solid ${b.tone === "red" ? "var(--red)" : b.tone === "amber" ? "var(--amber)" : "var(--accent)"}`,
                      background: `${b.tone === "red" ? "rgba(200,90,90,0.06)" : b.tone === "amber" ? "rgba(220,180,80,0.06)" : "rgba(90,160,255,0.06)"}`,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: b.tone === "red" ? "var(--red)" : b.tone === "amber" ? "var(--amber)" : "var(--accent)",
                    }}
                  >
                    {b.text}
                  </div>
                ))}
              </div>
            )}

            {/* Price strip */}
            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text-bright)" }}>
                  {stripPrice !== null ? `${liveCcy} ${stripPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                </span>
                {dayPct !== null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: dayPct >= 0 ? "var(--green)" : "var(--red)" }}>
                    {dayPct >= 0 ? "▲" : "▼"} {fmtPct(dayPct)}
                  </span>
                )}
                <span style={{ ...monoLabel, color: isStale ? "var(--amber)" : "var(--text-dim)" }}>
                  {isStale ? "⚠ " : ""}{asOf}
                </span>
              </div>
              {firstHolding && (
                <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)" }}>
                  {firstHolding.high_52w !== null && <span>52w high {fmtNum(firstHolding.high_52w)}</span>}
                  {firstHolding.low_52w !== null && <span>52w low {fmtNum(firstHolding.low_52w)}</span>}
                  {data.priceMeta?.ma20 !== null && data.priceMeta?.ma20 !== undefined && <span>MA20 {fmtNum(data.priceMeta.ma20)}</span>}
                  {data.priceMeta?.ma50 !== null && data.priceMeta?.ma50 !== undefined && <span>MA50 {fmtNum(data.priceMeta.ma50)}</span>}
                </div>
              )}
            </div>

            {/* Price chart */}
            <div style={sectionStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={sectionTitle}>Price History</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {[30, 90, 180].map((d) => (
                    <button
                      key={d}
                      onClick={() => setChartRange(d as 30 | 90 | 180)}
                      style={{
                        fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px",
                        background: chartRange === d ? "rgba(201,168,76,0.15)" : "transparent",
                        border: `1px solid ${chartRange === d ? "var(--gold)" : "var(--rim)"}`,
                        color: chartRange === d ? "var(--gold)" : "var(--text-dim)",
                        cursor: "pointer", borderRadius: 2,
                      }}
                    >{d}D</button>
                  ))}
                </div>
              </div>
              {!readyHeavy || (data.loading && data.pricePoints.length === 0)
                ? <SectionSkeleton rows={4} />
                : data.pricePoints.length === 0
                  ? <span style={monoLabel}>{data.errors.prices || "No price history available"}</span>
                  : <PriceChart points={chartPoints} height={160} milestones={milestones} />
              }
            </div>

            {/* Price Anchors (first add / last score with pct from now) */}
            <PriceAnchorsBlock data={data} livePrice={stripPrice} />

            {/* 6D Score Grid */}
            <div style={sectionStyle}>
              <div style={sectionTitle}>6D Score · {data.score?.score ?? data.rationale?.total_score ?? "—"} / 100</div>
              <ScoreMetaStrip data={data} />
              {!data.score && !data.rationale ? (
                <span style={monoLabel}>No score recorded</span>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {([
                    ["Substrate", data.score?.substrate, data.rationale?.substrate_score, data.rationale?.substrate_rationale],
                    ["Demand", data.score?.demand, data.rationale?.demand_score, data.rationale?.demand_rationale],
                    ["Moat", data.score?.moat, data.rationale?.moat_score, data.rationale?.moat_rationale],
                    ["Valuation", data.score?.valuation, data.rationale?.valuation_score, data.rationale?.valuation_rationale],
                    ["Mgmt", data.score?.mgmt, data.rationale?.mgmt_score, data.rationale?.mgmt_rationale],
                    ["Disruption", data.score?.disruption, data.rationale?.disruption_score, data.rationale?.disruption_rationale],
                  ] as const).map(([label, sheetVal, dbVal, rat]) => {
                    const v = sheetVal ?? dbVal ?? null;
                    return (
                      <div key={label} style={{ border: "1px solid var(--rim)", padding: "8px 10px", borderRadius: 2 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={monoLabel}>{label}</span>
                          <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text-bright)" }}>{v ?? "—"}</span>
                        </div>
                        {rat && <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-dim)", marginTop: 4, lineHeight: 1.4 }}>{rat}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
              {data.score && (data.score.buyLow || data.score.buyHigh) && (
                <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)" }}>
                  Buy zone: {fmtNum(data.score.buyLow)} – {fmtNum(data.score.buyHigh)}
                </div>
              )}
            </div>

            {/* Classification */}
            <div style={sectionStyle}>
              <div style={sectionTitle}>Classification</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                {([
                  ["Layer", layer],
                  ["Tier", data.score?.tier],
                  ["Return profile", data.score?.returnProfile],
                  ["Compounder subtype", data.score?.compounderSubtype],
                  ["Stack layer", data.score?.stackLayer || (data.rationale as any)?.stack_layer],
                  ["Substrate level", data.score?.substrateLevel || (data.rationale as any)?.substrate_level],
                  ["Factor primary", (firstHolding as any)?.factor_primary || (data.rationale as any)?.factor_primary],
                  ["Factor group", (firstHolding as any)?.factor_group || (data.rationale as any)?.factor_group],
                  ["Stage 2 subclass", (data.rationale as any)?.stage2_subclass],
                  ["China exposure", (data.rationale as any)?.china_exposure_flag],
                  ["Reclass status", (data.score as any)?.reclassStatus],
                  ["Held status", (data.score as any)?.heldStatus],
                ] as const).filter(([, v]) => v && String(v).trim() !== "").map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 8px", border: "1px solid var(--rim)", borderRadius: 2 }}>
                    <span style={{ color: "var(--text-dim)" }}>{k}</span>
                    <span style={{ color: "var(--text-bright)" }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Thesis */}
            {(data.score?.fullThesis || data.rationale?.thesis_summary) && (
              <div style={sectionStyle}>
                <div style={sectionTitle}>Thesis</div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, lineHeight: 1.55, color: "var(--text-mid)", whiteSpace: "pre-wrap" }}>
                  {data.score?.fullThesis || data.rationale?.thesis_summary}
                </div>
                {data.score?.changeNote && (
                  <div style={{ marginTop: 8, padding: "6px 8px", background: "rgba(140,140,170,0.06)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
                    Change note: {data.score.changeNote}
                  </div>
                )}
              </div>
            )}

            {/* Bull / Bear / Asymmetry */}
            {((data.rationale as any)?.bull_case || (data.rationale as any)?.bear_case || (data.rationale as any)?.asymmetry_ratio) && (
              <div style={sectionStyle}>
                <div style={sectionTitle}>Asymmetry</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ ...monoLabel, color: "var(--green)" }}>Bull</div>
                    <div style={{ fontSize: 11, color: "var(--text-mid)", marginTop: 4, lineHeight: 1.4 }}>{(data.rationale as any)?.bull_case || "—"}</div>
                  </div>
                  <div>
                    <div style={{ ...monoLabel, color: "var(--red)" }}>Bear</div>
                    <div style={{ fontSize: 11, color: "var(--text-mid)", marginTop: 4, lineHeight: 1.4 }}>{(data.rationale as any)?.bear_case || "—"}</div>
                  </div>
                  <div>
                    <div style={{ ...monoLabel, color: "var(--gold)" }}>Ratio</div>
                    <div style={{ fontSize: 14, color: "var(--gold)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{(data.rationale as any)?.asymmetry_ratio || "—"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Disruption v2 */}
            {(data.disruption || data.disruptionLatest) && (
              <DisruptionBlock data={data} />
            )}

            {/* Position (HELD only) — extended */}
            {isHeld && (
              <div style={sectionStyle}>
                <div style={sectionTitle}>Position</div>
                {data.holdings.map((h, i) => (
                  <div key={i} style={{ marginBottom: i < data.holdings.length - 1 ? 12 : 0 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", marginBottom: 4 }}>{h.account}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      <Cell label="MV" value={fmtMoney(h.mv)} />
                      <Cell label="AUM %" value={fmtPct(h.aum_pct)} />
                      <Cell label="G/L" value={fmtPct(h.gl)} tone={h.gl >= 0 ? "green" : "red"} />
                      <Cell label="Shares" value={h.shares ? h.shares.toLocaleString() : "—"} />
                      <Cell label="Cost £" value={fmtMoney(h.costGbp)} />
                      <Cell label="Cost local" value={h.costLocal ? h.costLocal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} />
                      <Cell label="Prev close" value={h.prevClose !== null ? h.prevClose.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} />
                      <Cell label="MA60" value={h.ma60 !== null ? fmtNum(h.ma60) : "—"} />
                      <Cell label="% below 52w hi" value={fmtPct(h.pct_below_52w_high)} />
                      <Cell label="% above 52w lo" value={fmtPct(h.pct_above_52w_low)} />
                      <Cell label="Action" value={h.action || "HOLD"} />
                      <Cell label="Alert" value={h.alert_status || "CLEAR"} tone={h.alert_status === "FIRED" ? "amber" : undefined} />
                      <Cell label="Alert fired" value={fmtDate(h.alert_fired_date)} />
                      <Cell label="Deploy £" value={h.deploy_target_gbp ? fmtMoney(h.deploy_target_gbp) : "—"} />
                    </div>
                    {(h.trigger_type || h.trigger_price_add || h.trigger_price_exit) && (
                      <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
                        Triggers · {[h.trigger_type, h.trigger_price_add && `ADD ${h.trigger_price_add}`, h.trigger_price_exit && `EXIT ${h.trigger_price_exit}`].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {(h.add_trigger || h.exit_trigger) && (
                      <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
                        {h.add_trigger && <div>ADD: {h.add_trigger}</div>}
                        {h.exit_trigger && <div>EXIT: {h.exit_trigger}</div>}
                      </div>
                    )}
                    {h.deploy_note && (
                      <div style={{ marginTop: 6, fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-mid)" }}>
                        <span style={monoLabel}>Deploy note </span>{h.deploy_note}
                      </div>
                    )}
                    {(h.trigger_review_date || h.trigger_review_note) && (
                      <div style={{ marginTop: 6, fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-mid)" }}>
                        <span style={monoLabel}>Review {fmtDate(h.trigger_review_date)} </span>{h.trigger_review_note}
                      </div>
                    )}
                    {h.notes && (
                      <div style={{ marginTop: 6, fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-mid)", whiteSpace: "pre-wrap" }}>
                        <span style={monoLabel}>Notes </span>{h.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Watchlist (WATCH only) — extended */}
            {isWatchlist && data.watchlist && (
              <div style={sectionStyle}>
                <div style={sectionTitle}>Watchlist</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  <Cell label="Status" value={data.watchlist.status} />
                  <Cell label="Alert" value={(data.watchlist as any).alertStatus || "—"} tone={(data.watchlist as any).alertStatus === "FIRED" ? "amber" : undefined} />
                  <Cell label="Entry target" value={data.watchlist.entry || "—"} />
                  <Cell label="Trigger px" value={(data.watchlist as any).triggerPriceNumeric !== null && (data.watchlist as any).triggerPriceNumeric !== undefined ? String((data.watchlist as any).triggerPriceNumeric) : "—"} />
                  <Cell label="Current" value={data.watchlist.current !== null ? String(data.watchlist.current) : (data.watchlist as any).currentRaw || "—"} />
                  <Cell label="Trigger" value={data.watchlist.trigger || "—"} />
                  <Cell label="Last checked" value={fmtDate((data.watchlist as any).lastChecked)} />
                  <Cell label="Deploy £" value={(data.watchlist as any).deploy_amount_gbp ? fmtMoney((data.watchlist as any).deploy_amount_gbp) : "—"} />
                </div>
                {((data.watchlist as any).triggerReviewDate || (data.watchlist as any).triggerReviewNote) && (
                  <div style={{ marginTop: 6, fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-mid)" }}>
                    <span style={monoLabel}>Review {fmtDate((data.watchlist as any).triggerReviewDate)} </span>{(data.watchlist as any).triggerReviewNote}
                  </div>
                )}
                {data.watchlist.rationale && (
                  <div style={{ marginTop: 8, fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--text-mid)", lineHeight: 1.5 }}>
                    {data.watchlist.rationale}
                  </div>
                )}
              </div>
            )}

            {/* Earnings */}
            {data.earnings && <EarningsBlock data={data} />}

            {/* Narrative signals */}
            {data.narratives.length > 0 && <NarrativeBlock rows={data.narratives} />}

            {/* Alerts log */}
            {data.alerts.length > 0 && <AlertsBlock rows={data.alerts} />}

            {/* Score history */}
            {data.rationaleHistory.length > 0 && (
              <div style={sectionStyle}>
                <div style={sectionTitle}>Score History</div>
                {data.rationaleHistory.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "5px 0", borderTop: i === 0 ? "none" : "1px dashed var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    <span style={{ color: "var(--text-dim)", minWidth: 90 }}>{h.scored_at?.slice(0, 10) || "—"}</span>
                    <span style={{ color: "var(--gold)", minWidth: 40 }}>{h.total_score ?? "—"}</span>
                    <span style={{ color: "var(--accent)", minWidth: 60 }}>{h.action || "—"}</span>
                    <span style={{ color: "var(--text-mid)", flex: 1 }}>{h.change_note || ""}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Footer actions */}
            <div style={{ ...sectionStyle, borderBottom: "none", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ClaudePromptButton
                templateKey="dropdown_deep_dive"
                context={{ ticker: tkr }}
                stopPropagation
              >
                Deep dive: {tkr} ➜
              </ClaudePromptButton>
              <a
                href={SHEET_SCORES_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
                  border: "1px solid var(--rim)", color: "var(--text-mid)",
                  padding: "4px 12px", borderRadius: 2, textDecoration: "none",
                }}
              >
                View in Scores sheet ↗
              </a>
              {data.earnings && (
                <button
                  onClick={() => triggerWebhook("stellar-earnings-prep", { ticker: tkr }, `Earnings prep triggered for ${tkr}. Check email.`)}
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
                    border: "1px solid var(--accent)", color: "var(--accent)", background: "none",
                    padding: "4px 12px", borderRadius: 2, cursor: "pointer",
                  }}
                >
                  Earnings prep ➜
                </button>
              )}
            </div>

            {/* Sticky footer — secondary close for long sheets */}
            <div style={{
              position: "sticky", bottom: 0, zIndex: 10,
              background: "linear-gradient(to top, var(--void) 70%, rgba(4,4,10,0))",
              padding: "12px 14px calc(12px + env(safe-area-inset-bottom))",
              borderTop: "1px solid var(--rim)",
              display: "flex", justifyContent: "center",
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  background: "var(--panel)", border: "1px solid var(--rim)",
                  color: "var(--text-mid)", padding: "10px 28px",
                  borderRadius: 2, cursor: "pointer", minHeight: 40, minWidth: 140,
                }}
              >Done</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string | number | null | undefined; tone?: "green" | "red" | "amber" }) {
  const color = tone === "green" ? "var(--green)" : tone === "red" ? "var(--red)" : tone === "amber" ? "var(--amber)" : "var(--text-bright)";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px", border: "1px solid var(--rim)", borderRadius: 2 }}>
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
      <span style={{ color }}>{value ?? "—"}</span>
    </div>
  );
}

function PriceAnchorsBlock({ data, livePrice }: { data: FactSheetData; livePrice: number | null }) {
  const first = resolveAnchor("first_add", data);
  const last = resolveAnchor("last_score", data);
  if (first.price === null && last.price === null && !first.date && !last.date) return null;
  const pct = (anchor: number | null) =>
    anchor !== null && livePrice !== null ? ((livePrice - anchor) / anchor) * 100 : null;
  const pFirst = pct(first.price);
  const pLast = pct(last.price);
  const Row = ({ title, a, p }: { title: string; a: typeof first; p: number | null }) => (
    <div style={{ border: "1px solid var(--rim)", padding: "8px 10px", borderRadius: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={monoLabel}>{title}</span>
        {a.source && <span style={{ ...monoLabel, color: "var(--text-dim)", fontSize: 8 }}>{a.source}</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 12 }}>
        <span style={{ color: "var(--text-bright)" }}>{a.price !== null ? a.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</span>
        <span style={{ color: "var(--text-dim)" }}>{fmtDate(a.date)}</span>
        <span style={{ color: p === null ? "var(--text-dim)" : p >= 0 ? "var(--green)" : "var(--red)" }}>
          {p === null ? "—" : `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`}
        </span>
      </div>
    </div>
  );
  return (
    <div style={sectionStyle}>
      <div style={sectionTitle}>Price Anchors</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        <Row title="First add" a={first} p={pFirst} />
        <Row title="Last score" a={last} p={pLast} />
      </div>
    </div>
  );
}

function ScoreMetaStrip({ data }: { data: FactSheetData }) {
  const s: any = data.score || {};
  const r: any = data.rationale || {};
  const items: Array<[string, string | number | null | undefined]> = [
    ["Scored", fmtDate(pickStr(s.scoreDate, r.scored_at))],
    ["Scorer", pickStr(s.scorer, r.scorer_version)],
    ["Conviction", pickStr(s.conviction, r.conviction)],
    ["Return profile", pickStr(s.returnProfile, r.return_profile)],
    ["Compounder", pickStr(s.compounderSubtype, r.compounder_subtype)],
    ["Substrate lvl", pickStr(s.substrateLevel, r.substrate_level)],
    ["Stack layer", pickStr(s.stackLayer, r.stack_layer)],
  ];
  const filled = items.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (filled.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
      {filled.map(([k, v]) => (
        <span key={k} style={{ ...monoLabel, color: "var(--text-mid)", border: "1px solid var(--rim)", padding: "2px 6px", borderRadius: 2 }}>
          {k} · <span style={{ color: "var(--text-bright)" }}>{v}</span>
        </span>
      ))}
    </div>
  );
}

function DisruptionBlock({ data }: { data: FactSheetData }) {
  const d: any = data.disruption || {};
  const l: any = data.disruptionLatest || {};
  const score = d.disruption_score ?? l.disruption_score ?? "—";
  const subs: Array<{ k: string; v: any; rat: string | null }> = [
    { k: "Sub avail", v: d.sub_avail_score ?? l.sub_avail, rat: d.sub_avail_rationale || null },
    { k: "Economics", v: d.economics_score ?? l.economics, rat: d.economics_rationale || null },
    { k: "Govt", v: d.govt_support_score ?? l.govt_support, rat: d.govt_support_rationale || null },
    { k: "Demand vuln", v: d.demand_vuln_score ?? l.demand_vuln, rat: d.demand_vuln_rationale || null },
    { k: "Time", v: d.time_viability_score ?? l.time_viability, rat: d.time_viability_rationale || null },
  ];
  return (
    <div style={sectionStyle}>
      <div style={sectionTitle}>Disruption Resilience · {score} / 25</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
        {subs.map((s) => (
          <div key={s.k} style={{ border: "1px solid var(--rim)", padding: "6px 6px", textAlign: "center", borderRadius: 2 }}>
            <div style={{ ...monoLabel, fontSize: 8 }}>{s.k}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--text-bright)" }}>{s.v ?? "—"}</div>
          </div>
        ))}
      </div>
      {subs.some((s) => s.rat) && (
        <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
          {subs.filter((s) => s.rat).map((s) => (
            <div key={s.k} style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-mid)", lineHeight: 1.4 }}>
              <span style={monoLabel}>{s.k} </span>{s.rat}
            </div>
          ))}
        </div>
      )}
      {(d.amber_triggers || d.red_triggers) && (
        <div style={{ marginTop: 8, display: "grid", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {d.amber_triggers && <div style={{ color: "var(--amber)" }}>AMBER: {d.amber_triggers}</div>}
          {d.red_triggers && <div style={{ color: "var(--red)" }}>RED: {d.red_triggers}</div>}
        </div>
      )}
      {d.evidence && (
        <div style={{ marginTop: 8, fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-dim)" }}>{d.evidence}</div>
      )}
      {(d.scorer_version || d.scored_at) && (
        <div style={{ marginTop: 6, ...monoLabel, color: "var(--text-dim)" }}>
          {d.scorer_version && <>scorer {d.scorer_version} · </>}{fmtDate(d.scored_at)}
        </div>
      )}
    </div>
  );
}

function EarningsBlock({ data }: { data: FactSheetData }) {
  const e: any = data.earnings || {};
  return (
    <div style={sectionStyle}>
      <div style={sectionTitle}>Earnings</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <Cell label="Next" value={fmtDate(e.next_earnings_date || e.date)} />
        <Cell label="Period" value={pickStr(e.fiscal_period, e.period)} />
        <Cell label="Confirmed" value={e.confirmed === true ? "YES" : e.confirmed === false ? "NO" : "—"} tone={e.confirmed === false ? "amber" : undefined} />
      </div>
      {e.notes && (
        <div style={{ marginTop: 6, fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-mid)" }}>{e.notes}</div>
      )}
    </div>
  );
}

function NarrativeBlock({ rows }: { rows: FactSheetData["narratives"] }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionTitle}>Narrative Signals</div>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((n: any) => (
          <div key={n.id} style={{ borderTop: "1px dashed var(--rim)", paddingTop: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 10 }}>
              <span style={{ color: "var(--text-dim)" }}>{fmtDate(n.published_date || n.created_at)}</span>
              {n.strength && <span style={{ color: "var(--accent)" }}>· {n.strength}</span>}
              {n.signal_class && <span style={{ color: "var(--gold)" }}>· {n.signal_class}</span>}
              {n.source_table && <span style={{ color: "var(--text-dim)" }}>· {n.source_table}</span>}
              {n.review_status && <span style={{ color: "var(--text-mid)" }}>· {n.review_status}</span>}
            </div>
            {n.headline && (
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--text-bright)", marginTop: 2 }}>
                {n.url ? <a href={n.url} target="_blank" rel="noreferrer" style={{ color: "var(--text-bright)" }}>{n.headline}</a> : n.headline}
              </div>
            )}
            {n.snippet && (
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-mid)", marginTop: 2, lineHeight: 1.4 }}>{n.snippet}</div>
            )}
            {n.matched_keywords && (
              <div style={{ ...monoLabel, marginTop: 2 }}>kw: {Array.isArray(n.matched_keywords) ? n.matched_keywords.join(", ") : String(n.matched_keywords)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsBlock({ rows }: { rows: FactSheetData["alerts"] }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionTitle}>Alerts Log</div>
      <div style={{ display: "grid", gap: 4 }}>
        {rows.map((a: any) => (
          <div key={a.id} style={{ display: "flex", gap: 10, fontFamily: "var(--font-mono)", fontSize: 11, borderTop: "1px dashed var(--rim)", padding: "4px 0" }}>
            <span style={{ color: "var(--text-dim)", minWidth: 90 }}>{fmtDate(a.triggered_at)}</span>
            <span style={{ color: "var(--accent)", minWidth: 90 }}>{a.alert_type || "—"}</span>
            <span style={{ color: "var(--text-mid)", minWidth: 100 }}>{a.previous_status || "—"} → {a.new_status || "—"}</span>
            <span style={{ color: "var(--text-bright)", flex: 1 }}>
              {a.trigger_value !== null && a.trigger_value !== undefined ? `val ${a.trigger_value}` : ""}
              {a.threshold !== null && a.threshold !== undefined ? ` / thr ${a.threshold}` : ""}
              {a.note ? ` · ${a.note}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
