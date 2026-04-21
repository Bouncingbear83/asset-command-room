import { CSSProperties, useState } from "react";
import type { AssetIntelligence, DisruptionStatus } from "@/types/intelligence";
import { PriceChart } from "@/components/intelligence/PriceChart";
import { CLAUDE_PROJECT_URL, buildDeepDivePrompt } from "@/lib/claudePrompts";
import "./AssetExpansion.css";

interface Props {
  asset: AssetIntelligence;
}

// ── Shared utilities ────────────────────────────────────────────────────────

function pctColor(pct: number): string {
  if (pct >= 80) return "var(--green)";
  if (pct >= 50) return "var(--amber)";
  return "var(--red)";
}

function disruptionColor(status: DisruptionStatus): { bg: string; fg: string; border: string } {
  switch (status) {
    case "GREEN": return { bg: "var(--green-dim)", fg: "var(--green)", border: "rgba(90,191,160,0.25)" };
    case "AMBER": return { bg: "var(--amber-dim)", fg: "var(--amber)", border: "rgba(200,146,90,0.25)" };
    case "RED":   return { bg: "var(--red-dim)",   fg: "var(--red)",   border: "rgba(200,90,90,0.25)" };
  }
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", GBX: "p", JPY: "¥" };

function formatCurrency(value: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency.toUpperCase()] ?? `${currency} `;
  const fmt = value >= 1000 ? value.toFixed(0) : value.toFixed(value < 10 ? 2 : 1);
  return `${sym}${fmt}`;
}

function formatGbp(value: number): string {
  if (Math.abs(value) >= 1000) return `£${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
  return `£${value.toFixed(0)}`;
}

function formatBuyRange(low: number | null, high: number | null, currency: string): string {
  if (low === null || high === null) return "—";
  return `${formatCurrency(low, currency)}–${formatCurrency(high, currency)}`;
}

// ── Style tokens ────────────────────────────────────────────────────────────

const SECTION_STYLE: CSSProperties = {
  padding: "16px 20px",
  borderBottom: "1px solid var(--rim)",
};

const SECTION_LAST_STYLE: CSSProperties = { ...SECTION_STYLE, borderBottom: "none" };

const LABEL_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  marginBottom: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const CARD_STYLE: CSSProperties = {
  background: "rgba(28,28,48,0.18)",
  border: "1px solid var(--rim)",
  padding: 12,
  borderRadius: 6,
};

const META_STRIP_STYLE: CSSProperties = {
  marginTop: 10,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.06em",
  color: "var(--text-dim)",
};

const NO_DATA_STYLE: CSSProperties = {
  fontSize: 11,
  color: "var(--text-dim)",
  fontStyle: "italic",
};

// ── Sub-components ──────────────────────────────────────────────────────────

function ScoreChip({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <span style={{
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      fontWeight: 600,
      color: pctColor(pct),
      whiteSpace: "nowrap",
    }}>
      {Number.isInteger(value) ? value : value.toFixed(1)}<span style={{ color: "var(--text-dim)", fontSize: 9 }}>/{max}</span>
    </span>
  );
}

function ExpandableText({ text, clampLines, emptyLabel }: { text: string; clampLines: number; emptyLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = (text ?? "").trim();
  if (!trimmed) return <div style={NO_DATA_STYLE}>{emptyLabel}</div>;

  const baseStyle: CSSProperties = {
    fontSize: 12,
    lineHeight: 1.5,
    color: "var(--text-mid)",
    whiteSpace: "pre-wrap",
    ...(expanded ? {} : {
      display: "-webkit-box",
      WebkitLineClamp: clampLines,
      WebkitBoxOrient: "vertical" as const,
      overflow: "hidden",
    }),
  };

  // Heuristic: only show toggle if text is plausibly longer than clamp
  const showToggle = trimmed.length > clampLines * 80 || trimmed.split("\n").length > clampLines;

  return (
    <div>
      <div style={baseStyle}>{trimmed}</div>
      {showToggle && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          style={{
            marginTop: 4,
            background: "none",
            border: "none",
            color: "var(--gold)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {expanded ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}

function TrendBadge({ trend }: { trend?: { delta: number | null; direction: "up" | "down" | "flat" | null; prior_value: number | null } }) {
  if (!trend || trend.direction === null) return null;
  const color = trend.direction === "up" ? "var(--green)" : trend.direction === "down" ? "var(--red)" : "var(--text-dim)";
  const arrow = trend.direction === "up" ? "↗" : trend.direction === "down" ? "↘" : "→";
  const sign = trend.delta !== null && trend.delta > 0 ? "+" : "";
  return (
    <span
      title={trend.prior_value !== null ? `Prior: ${trend.prior_value}` : undefined}
      style={{ fontFamily: "var(--font-mono)", fontSize: 9, color, marginLeft: 6 }}
    >
      {arrow}{trend.direction !== "flat" && trend.delta !== null ? `${sign}${trend.delta}` : ""}
    </span>
  );
}

function RationaleCard({
  label, score, max, rationale, trend, emptyLabel,
}: { label: string; score: number; max: number; rationale: string; trend?: { delta: number | null; direction: "up" | "down" | "flat" | null; prior_value: number | null }; emptyLabel?: string }) {
  // If we have a real score but no rationale text, signal that explicitly.
  const fallbackEmpty = score > 0 ? "Scored — rationale not archived." : "No rationale recorded.";
  return (
    <div style={CARD_STYLE}>
      <div style={LABEL_STYLE}>
        <span>{label}</span>
        <span style={{ display: "inline-flex", alignItems: "baseline" }}>
          <ScoreChip value={score} max={max} />
          <TrendBadge trend={trend} />
        </span>
      </div>
      <ExpandableText text={rationale} clampLines={4} emptyLabel={emptyLabel ?? fallbackEmpty} />
    </div>
  );
}

function TriggerBanner({
  variant, label, body,
}: { variant: "amber" | "red" | "green"; label: string; body: string }) {
  const palette = {
    amber: { fg: "var(--amber)", bg: "var(--amber-dim)", border: "var(--amber)", icon: "⚠" },
    red:   { fg: "var(--red)",   bg: "var(--red-dim)",   border: "var(--red)",   icon: "●" },
    green: { fg: "var(--green)", bg: "var(--green-dim)", border: "var(--green)", icon: "▲" },
  }[variant];
  return (
    <div style={{
      marginTop: 10,
      padding: "10px 12px",
      borderLeft: `3px solid ${palette.border}`,
      background: palette.bg,
      borderRadius: 4,
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
    }}>
      <span style={{ color: palette.fg, fontSize: 12, lineHeight: "18px" }}>{palette.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: palette.fg,
          marginBottom: 2,
        }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-mid)", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{body}</div>
      </div>
    </div>
  );
}

function MetricCell({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={CARD_STYLE}>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--text-dim)",
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 14,
        fontWeight: 600,
        color: color ?? "var(--text-mid)",
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Section: Price context (52w bar) ────────────────────────────────────────

function FiftyTwoWeekBar({ asset }: { asset: AssetIntelligence }) {
  const p = asset.position;
  if (!p) return null;
  const lo = p.low_52w;
  const hi = p.high_52w;
  if (!(hi > lo)) return null;

  const pctOf = (v: number) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  const currentPct = pctOf(p.price_local);
  const ma60Pct = p.ma60 > 0 ? pctOf(p.ma60) : null;

  // Buy range overlay (only if range falls within 52w window)
  const br = asset.buy_range;
  let overlay: { left: number; width: number } | null = null;
  if (br.low !== null && br.high !== null) {
    const a = pctOf(br.low);
    const b = pctOf(br.high);
    overlay = { left: Math.min(a, b), width: Math.abs(b - a) };
  }

  return (
    <div style={{ position: "relative", height: 28, marginTop: 6 }}>
      <div style={{
        position: "absolute",
        top: 12,
        left: 0,
        right: 0,
        height: 4,
        background: "var(--muted)",
        borderRadius: 2,
      }} />
      {overlay && overlay.width > 0 && (
        <div style={{
          position: "absolute",
          top: 10,
          left: `${overlay.left}%`,
          width: `${overlay.width}%`,
          height: 8,
          background: "rgba(201,168,76,0.18)",
          border: "1px solid rgba(201,168,76,0.35)",
          borderRadius: 2,
        }} title={`Buy range: ${formatBuyRange(br.low, br.high, br.currency)}`} />
      )}
      {ma60Pct !== null && (
        <div style={{
          position: "absolute",
          top: 6,
          left: `calc(${ma60Pct}% - 1px)`,
          width: 2,
          height: 16,
          background: "var(--text-dim)",
        }} title={`MA60: ${formatCurrency(p.ma60, p.currency)}`} />
      )}
      <div style={{
        position: "absolute",
        top: 4,
        left: `calc(${currentPct}% - 5px)`,
        width: 10,
        height: 20,
        background: "var(--accent)",
        border: "2px solid var(--void)",
        borderRadius: 2,
      }} title={`Current: ${formatCurrency(p.price_local, p.currency)}`} />
    </div>
  );
}

// ── Main expansion ──────────────────────────────────────────────────────────

export function AssetExpansion({ asset }: Props) {
  const showDisruption = asset.disruption !== null;
  const showPosition = asset.position !== null;

  const hasMetaFooterBorder = false; // last section
  void hasMetaFooterBorder;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "rgba(0,0,0,0.25)",
        borderTop: "1px solid var(--rim)",
        cursor: "default",
      }}
    >
      {/* ─── Section 1: THESIS ──────────────────────────────────────── */}
      {(() => {
        const fullThesis = (asset.thesis ?? "").trim();
        const changeNote = (asset.change_note ?? "").trim();
        const thesisSource: "full" | "change_note" | "none" =
          fullThesis ? "full" : changeNote ? "change_note" : "none";
        const thesisBody = thesisSource === "full" ? fullThesis : thesisSource === "change_note" ? changeNote : "";

        return (
          <div style={SECTION_STYLE}>
            <div style={LABEL_STYLE}><span>Thesis</span></div>
            {thesisSource === "change_note" && (
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--amber)",
                marginBottom: 6,
              }}>
                Thesis (latest change note — full thesis not yet written)
              </div>
            )}
            <ExpandableText text={thesisBody} clampLines={3} emptyLabel="No thesis recorded." />
            <div style={META_STRIP_STYLE}>
              {[
                // Only surface change note in metadata when we already showed the full thesis
                thesisSource === "full" && changeNote ? `Last change: ${changeNote}` : null,
                asset.score_date ? `Scored: ${asset.score_date}` : null,
                asset.trend.prior_score_date ? `Prior scored: ${asset.trend.prior_score_date}` : null,
                `Reclass: ${asset.reclass_status || "PENDING"}`,
                `Age: ${asset.thesis_age_months}mo`,
              ].filter(Boolean).join("  ·  ")}
            </div>
          </div>
        );
      })()}

      {/* ─── Section 2: 6D RATIONALES ───────────────────────────────── */}
      <div style={SECTION_STYLE}>
        <div style={LABEL_STYLE}><span>6D Rationales</span></div>
        <div className="aex-grid-6d">
          <RationaleCard label="Substrate"  score={asset.sub_scores.substrate}        max={25} rationale={asset.rationales.score.substrate}  trend={asset.trend.substrate} />
          <RationaleCard label="Demand"     score={asset.sub_scores.demand}           max={22} rationale={asset.rationales.score.demand}     trend={asset.trend.demand} />
          <RationaleCard label="Moat"       score={asset.sub_scores.moat}             max={18} rationale={asset.rationales.score.moat}       trend={asset.trend.moat} />
          <RationaleCard label="Valuation"  score={asset.sub_scores.valuation}        max={13} rationale={asset.rationales.score.valuation}  trend={asset.trend.valuation} />
          <RationaleCard label="Management" score={asset.sub_scores.mgmt}             max={7}  rationale={asset.rationales.score.mgmt}       trend={asset.trend.mgmt} />
          <RationaleCard label="Disruption" score={asset.sub_scores.disruption_score} max={15} rationale={asset.rationales.score.disruption} trend={asset.trend.disruption} />
        </div>
      </div>

      {/* ─── Section 3: DISRUPTION DEEP DIVE ────────────────────────── */}
      {showDisruption && asset.disruption && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>
            <span>Disruption Deep Dive</span>
            {(() => {
              const c = disruptionColor(asset.disruption.status);
              return (
                <span style={{
                  padding: "3px 10px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  background: c.bg,
                  color: c.fg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 2,
                }}>
                  {asset.disruption.status} {Math.round(asset.disruption.total)}/100
                </span>
              );
            })()}
          </div>
          <div className="aex-grid-disruption">
            <RationaleCard label="Sub Avail"      score={asset.disruption.sub_avail}      max={20} rationale={asset.rationales.disruption?.sub_avail ?? ""} />
            <RationaleCard label="Economics"      score={asset.disruption.economics}      max={20} rationale={asset.rationales.disruption?.economics ?? ""} />
            <RationaleCard label="Govt Support"   score={asset.disruption.govt_support}   max={20} rationale={asset.rationales.disruption?.govt_support ?? ""} />
            <RationaleCard label="Demand Vuln"    score={asset.disruption.demand_vuln}    max={20} rationale={asset.rationales.disruption?.demand_vuln ?? ""} />
            <RationaleCard label="Time Viability" score={asset.disruption.time_viability} max={20} rationale={asset.rationales.disruption?.time_viability ?? ""} />
          </div>
          {asset.disruption.amber_trigger && (
            <TriggerBanner variant="amber" label="Amber Trigger" body={asset.disruption.amber_trigger} />
          )}
          {asset.disruption.red_trigger && (
            <TriggerBanner variant="red" label="Red Trigger" body={asset.disruption.red_trigger} />
          )}
          {asset.disruption.evidence && (
            <div style={{
              marginTop: 10,
              padding: "10px 12px",
              borderLeft: "2px solid var(--rim)",
              background: "rgba(28,28,48,0.12)",
              borderRadius: 4,
            }}>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginBottom: 4,
              }}>Evidence</div>
              <div style={{ fontSize: 12, color: "var(--text-mid)", fontStyle: "italic", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                "{asset.disruption.evidence}"
              </div>
            </div>
          )}
          {asset.disruption.last_checked && (
            <div style={META_STRIP_STYLE}>Last assessed: {asset.disruption.last_checked}</div>
          )}
        </div>
      )}

      {/* ─── Section 4: PRICE CONTEXT (held only) ───────────────────── */}
      {showPosition && asset.position && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}><span>Price Context</span></div>
          <PriceChart ticker={asset.ticker} currency={asset.position.currency} defaultRange="1Y" />
          <FiftyTwoWeekBar asset={asset} />
          <div style={{
            marginTop: 8,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-dim)",
            flexWrap: "wrap",
            gap: 8,
          }}>
            <span>52W low: {formatCurrency(asset.position.low_52w, asset.position.currency)}</span>
            <span style={{ color: "var(--accent)" }}>● current: {formatCurrency(asset.position.price_local, asset.position.currency)}</span>
            <span>MA60: {formatCurrency(asset.position.ma60, asset.position.currency)}</span>
            <span>52W high: {formatCurrency(asset.position.high_52w, asset.position.currency)}</span>
          </div>
        </div>
      )}

      {/* ─── Section 5: POSITION (held only) ────────────────────────── */}
      {showPosition && asset.position && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>
            <span>Position</span>
            <span style={{
              padding: "3px 10px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              background: "var(--accent)",
              color: "var(--void)",
              borderRadius: 2,
            }}>
              {asset.position.account}
            </span>
          </div>
          <div className="aex-grid-position">
            <MetricCell label="MV (£)"   value={formatGbp(asset.position.mv_gbp)} />
            <MetricCell label="AUM %"    value={`${asset.position.aum_pct.toFixed(1)}%`} />
            <MetricCell label="Cost"     value={formatGbp(asset.position.cost_gbp)} />
            <MetricCell
              label="P&L £"
              value={`${asset.position.mv_gbp - asset.position.cost_gbp >= 0 ? "+" : ""}${formatGbp(asset.position.mv_gbp - asset.position.cost_gbp)}`}
              color={asset.position.mv_gbp - asset.position.cost_gbp >= 0 ? "var(--green)" : "var(--red)"}
            />
            <MetricCell
              label="G/L %"
              value={`${asset.position.gl_pct >= 0 ? "+" : ""}${asset.position.gl_pct.toFixed(1)}%`}
              color={asset.position.gl_pct >= 0 ? "var(--green)" : "var(--red)"}
            />
            <MetricCell
              label="Day %"
              value={`${asset.position.day_pct >= 0 ? "+" : ""}${asset.position.day_pct.toFixed(2)}%`}
              color={asset.position.day_pct >= 0 ? "var(--green)" : "var(--red)"}
            />
            <MetricCell label="Shares"   value={asset.position.shares.toLocaleString()} />
            <MetricCell label="Ann. Ret" value={<span style={{ color: "var(--text-dim)", fontSize: 11 }}>—</span>} />
          </div>

          {asset.position.add_trigger && (
            <TriggerBanner
              variant="green"
              label="Add"
              body={
                asset.position.trigger_price_add !== null
                  ? `${asset.position.add_trigger}\nTrigger price: ${formatCurrency(asset.position.trigger_price_add, asset.position.currency)}`
                  : asset.position.add_trigger
              }
            />
          )}
          {asset.position.exit_trigger && (
            <TriggerBanner
              variant="red"
              label="Exit"
              body={
                asset.position.trigger_price_exit !== null
                  ? `${asset.position.exit_trigger}\nTrigger price: ${formatCurrency(asset.position.trigger_price_exit, asset.position.currency)}`
                  : asset.position.exit_trigger
              }
            />
          )}

          <div style={{
            marginTop: 10,
            display: "flex",
            gap: 16,
            alignItems: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-dim)",
            flexWrap: "wrap",
          }}>
            {asset.position.trigger_type && <span>Type: {asset.position.trigger_type}</span>}
            {asset.position.alert_status && (() => {
              const s = asset.position.alert_status.toLowerCase();
              const color = s.includes("fired") || s.includes("breach") ? "var(--red)"
                          : s.includes("near") || s.includes("warn")     ? "var(--amber)"
                          : "var(--green)";
              return (
                <span style={{
                  padding: "2px 8px",
                  border: `1px solid ${color}`,
                  color,
                  borderRadius: 2,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontSize: 9,
                }}>
                  {asset.position.alert_status}
                </span>
              );
            })()}
            {asset.position.factor_primary && <span>Primary factor: {asset.position.factor_primary}</span>}
          </div>
        </div>
      )}

      {/* ─── Section 6: META FOOTER ─────────────────────────────────── */}
      <div style={SECTION_LAST_STYLE}>
        <div style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-dim)",
          letterSpacing: "0.06em",
        }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const prompt = buildDeepDivePrompt(asset.ticker);
              const url = `${CLAUDE_PROJECT_URL}?prefill=${encodeURIComponent(prompt)}`;
              // iframe-CSP-safe external open (per project memory)
              (window.top || window).open(url, "_blank");
            }}
            style={{
              padding: "4px 12px",
              background: "transparent",
              color: "var(--gold)",
              border: "1px solid var(--gold-dim)",
              borderRadius: 2,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Deep dive →
          </button>
          <span>·</span>
          <span>Buy range: {formatBuyRange(asset.buy_range.low, asset.buy_range.high, asset.buy_range.currency)}</span>
          <span>·</span>
          <span>Score {Math.round(asset.score)}/100</span>
          <span>·</span>
          <span>Tier: {asset.tier ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}

export default AssetExpansion;
