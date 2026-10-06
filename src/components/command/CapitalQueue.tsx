import { useMemo, useState } from "react";
import { DP_MIN_PCT, QUEUE_BLOCK_ACTIONS, QUEUE_MIN_GBP } from "@/config/signalRules";
import { buildDeadSet, parseZone } from "@/lib/actionSurface";
import { LiveHolding, LiveWatchItem, LiveLayer, LiveMacroStateRow } from "@/hooks/usePortfolioData";
import TickerButton from "@/components/factsheet/TickerButton";
import { useIsMobile } from "@/hooks/use-mobile";

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--text-mid)",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value || 0);
}

/**
 * Priority logic (doctrinal):
 *
 * 0 = SIZE UP on existing Core (Rule #2: winners deserve more)
 * 1 = TOP-UP existing below target
 * 2 = NEW BUY T1 from watchlist in zone
 * 3 = NEW BUY T2/T3 from watchlist
 * 4 = Watchlist near zone (staged)
 *
 * Within same priority: underweight layer gaps rank higher.
 */

interface QueueItem {
  ticker: string;
  action: string;
  amount: number;
  layer: string;
  context: string;
  price: number;
  priority: number;
  layerGap: number; // negative = underweight (higher priority)
  isWatchlist: boolean;
  tier: number | null;
}

const ACTION_STYLE: Record<string, { color: string; bg: string }> = {
  "SIZE UP": { color: "var(--green)", bg: "var(--green-dim)" },
  "TOP-UP": { color: "var(--green)", bg: "var(--green-dim)" },
  BUY: { color: "var(--gold)", bg: "rgba(201,168,76,0.10)" },
  "BUY T1": { color: "var(--gold)", bg: "rgba(201,168,76,0.15)" },
  "BUY T2": { color: "var(--gold)", bg: "rgba(201,168,76,0.08)" },
  "BUY T3": { color: "var(--gold)", bg: "rgba(201,168,76,0.05)" },
  STAGE: { color: "var(--text-dim)", bg: "rgba(80,80,120,0.08)" },
};

interface Props {
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
  layers: LiveLayer[];
  macroState: Record<string, LiveMacroStateRow>;
  /** Gross dry powder % of AUM (R21) — Armed requires the DP gate to pass. */
  dpPct?: number | null;
  scores?: { ticker: string; heldStatus?: string }[];
}

export default function CapitalQueue({ holdings, watchlist, layers, macroState, dpPct = null, scores = [] }: Props) {
  const [gapsOpen, setGapsOpen] = useState(false);
  const dpGate = dpPct == null || dpPct > DP_MIN_PCT;
  const dead = useMemo(() => buildDeadSet(holdings, watchlist, scores), [holdings, watchlist, scores]);
  const isMobile = useIsMobile();

  // Pause status
  const pauseRow = macroState["PAUSE_ACTIVE"];
  const isPaused = pauseRow && ["YES", "TRUE", "ACTIVE"].includes(pauseRow.currentValue.toUpperCase());

  // Layer gap map: layer name → gap percentage (negative = underweight)
  const layerGapMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of layers) {
      if (l.name.toUpperCase() === "TOTAL" || l.name.toUpperCase() === "CASH") continue;
      const gap = (l.current ?? 0) - (l.target ?? 0);
      m.set(l.name.toUpperCase(), gap);
    }
    return m;
  }, [layers]);

  const holdingsTickers = useMemo(() => new Set(holdings.map((h) => h.ticker.toUpperCase())), [holdings]);

  // R19 — Armed (trigger met, not blocked, DP gate passes) vs Gaps (target − actual, informational).
  const { queue, gaps } = useMemo(() => {
    const items: QueueItem[] = [];
    const gapItems: QueueItem[] = [];
    const blocked = (a: string) => (QUEUE_BLOCK_ACTIONS as readonly string[]).some((b) => a.toUpperCase().includes(b));

    holdings.forEach((h) => {
      if (dead.has(h.ticker.toUpperCase())) return;
      const target = h.deploy_target_gbp;
      if (target <= 0 || target <= h.mv) return;
      const amount = Math.round(target - h.mv);
      if (amount < QUEUE_MIN_GBP) return;
      const act = h.action.trim().toUpperCase();
      const action = act === "SIZE UP" ? "SIZE UP" : "TOP-UP";
      const priority = action === "SIZE UP" ? 0 : 1;
      const layerGap = layerGapMap.get(h.layer.toUpperCase()) ?? 0;
      const context = h.deploy_note || `${h.action} · ${h.notes}`.trim() || `Deploy to ${formatCurrency(target)} target`;
      const add = parseFloat(String(h.trigger_price_add ?? ""));
      const triggerMet = h.alert_status.toUpperCase() === "ADD_ZONE" || (add > 0 && h.price > 0 && h.price <= add);
      const blk = blocked(act) || blocked(h.deploy_note || "") || blocked(h.notes || "");
      const row: QueueItem = { ticker: h.ticker, action, amount, layer: h.layer, context, price: h.price, priority, layerGap, isWatchlist: false, tier: null };
      if (triggerMet && !blk && dpGate) items.push(row);
      else gapItems.push({ ...row, action: "GAP" });
    });

    watchlist.forEach((w) => {
      if (!w.status.toUpperCase().startsWith("BUY")) return;
      if (dead.has(w.ticker.toUpperCase())) return;
      if (holdingsTickers.has(w.ticker.toUpperCase())) return;
      const amount = w.deploy_amount_gbp;
      if (amount < QUEUE_MIN_GBP) return;
      const tierMatch = w.status.match(/T(\d)/i);
      const tier = tierMatch ? parseInt(tierMatch[1], 10) : 9;
      const priority = tier <= 1 ? 2 : 3;
      const layerGap = layerGapMap.get(w.layer.toUpperCase()) ?? 0;
      const action = tier <= 3 ? `BUY T${tier}` : "BUY";
      const context = w.trigger || `Entry at ${w.entry}`;
      const px = typeof w.current === "number" ? w.current : 0;
      const edge = w.triggerPriceNumeric && w.triggerPriceNumeric > 0 ? w.triggerPriceNumeric : parseZone(w.entry)?.high ?? 0;
      const row: QueueItem = { ticker: w.ticker, action, amount, layer: w.layer, context, price: px, priority, layerGap, isWatchlist: true, tier };
      if (px > 0 && edge > 0 && px <= edge && dpGate) items.push(row);
      else gapItems.push({ ...row, action: "GAP" });
    });

    const sorter = (a: QueueItem, b: QueueItem) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.layerGap !== b.layerGap) return a.layerGap - b.layerGap;
      return b.amount - a.amount;
    };
    items.sort(sorter);
    gapItems.sort((a, b) => b.amount - a.amount);
    return { queue: items, gaps: gapItems };
  }, [holdings, watchlist, layerGapMap, holdingsTickers, dead, dpGate]);

  const deployTotal = queue.reduce((sum, d) => sum + d.amount, 0);
  const mp = isMobile ? "10px 12px" : "10px 16px";

  return (
    <div style={{ ...card, borderLeft: `3px solid ${isPaused ? "var(--amber)" : "var(--green)"}` }}>
      <div style={cardHeader}>
        <span style={cardTitle}>Capital Queue · Armed {isPaused ? "(paused)" : ""}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
          {queue.length > 0 ? `${queue.length} armed · ${formatCurrency(deployTotal)}` : "0 armed"}
          {!dpGate && <span style={{ color: "var(--amber)", marginLeft: 6 }}>· DP gate closed ({dpPct?.toFixed(1)}% ≤ {DP_MIN_PCT}%)</span>}
        </span>
      </div>
      <div style={{ padding: mp }}>
        {isPaused && (
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--amber)",
            marginBottom: 10,
            padding: "6px 8px",
            background: "var(--amber-dim)",
            border: "1px solid rgba(200,146,90,0.2)",
            borderRadius: 2,
          }}>
            Deploy pause active. Queue shows priority order for when pause lifts.
          </div>
        )}
        {queue.length === 0 ? (
          <div style={{ padding: "12px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
            Nothing armed
          </div>
        ) : (
          queue.map((d, i) => {
            const actionStyle = ACTION_STYLE[d.action] ?? ACTION_STYLE.BUY;
            const isUnderweight = d.layerGap < -1.5;

            if (isMobile) {
              return (
                <div key={`${d.ticker}-${i}`} style={{ padding: "8px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", width: 14 }}>{i + 1}.</span>
                    <TickerButton ticker={d.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                      {d.ticker}
                    </TickerButton>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 8,
                      letterSpacing: "0.08em",
                      padding: "1px 5px",
                      borderRadius: 2,
                      color: actionStyle.color,
                      background: actionStyle.bg,
                    }}>
                      {d.action}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", marginLeft: "auto" }}>
                      {formatCurrency(d.amount)}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", paddingLeft: 22, display: "flex", gap: 6, alignItems: "center" }}>
                    <span>{d.layer}</span>
                    {isUnderweight && <span style={{ color: "var(--amber)", fontSize: 8 }}>({d.layerGap.toFixed(1)}pp)</span>}
                    <span style={{ color: "var(--text-dim)" }}>·</span>
                    <span style={{ color: "var(--text-mid)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.context}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={`${d.ticker}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", width: 14 }}>{i + 1}.</span>
                <TickerButton ticker={d.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 50 }}>
                  {d.ticker}
                </TickerButton>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  letterSpacing: "0.08em",
                  padding: "1px 5px",
                  borderRadius: 2,
                  color: actionStyle.color,
                  background: actionStyle.bg,
                  flexShrink: 0,
                }}>
                  {d.action}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", minWidth: 60 }}>
                  {formatCurrency(d.amount)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", minWidth: 60 }}>{d.layer}</span>
                {isUnderweight && <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--amber)" }}>({d.layerGap.toFixed(1)}pp)</span>}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.context}</span>
              </div>
            );
          })
        )}
        {gaps.length > 0 && (
          <div style={{ marginTop: 10, borderTop: "1px solid var(--rim)", paddingTop: 8 }}>
            <button
              onClick={() => setGapsOpen((o) => !o)}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-dim)" }}
            >
              {gapsOpen ? "▾" : "▸"} Gaps · {gaps.length} · {formatCurrency(gaps.reduce((s, g) => s + g.amount, 0))} (informational)
            </button>
            {gapsOpen && gaps.map((g) => (
              <div key={`gap-${g.ticker}-${g.isWatchlist}`} style={{ display: "flex", gap: 10, padding: "4px 0", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
                <span style={{ minWidth: 60, color: "var(--text-mid)" }}>{g.ticker}</span>
                <span style={{ minWidth: 60 }}>{formatCurrency(g.amount)}</span>
                <span style={{ minWidth: 60 }}>{g.layer}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.context}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
