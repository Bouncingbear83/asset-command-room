import { useMemo, useState } from "react";
import { LiveHolding, LiveWatchItem, LiveEarningsCalendarItem } from "@/hooks/usePortfolioData";
import { useDailyPrices, normaliseTicker } from "@/hooks/useDailyPrices";
import { useWatchlistHistory } from "@/hooks/useWatchlistHistory";
import { Sparkline } from "@/components/Sparkline";
import TickerButton from "@/components/factsheet/TickerButton";
import { useIsMobile } from "@/hooks/use-mobile";

type Period = "1D" | "1W" | "1M";

interface MoverRow {
  ticker: string;
  price: number;
  change: number; // percent
  mv: number;
  currency: string;
  isWatchlist: boolean;
  isBordier: boolean;
  flags: string[]; // doctrine flags: "ADD", "EXIT", "ERN", "VOL"
  sparkPoints: { date: string; priceLocal: number; priceGbp: number }[] | null;
  sparkColor: "green" | "red" | "neutral";
  entry?: string; // WL entry target
}

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

function daysUntil(value: string): number {
  if (!value) return Infinity;
  const d = new Date(value);
  if (isNaN(d.getTime())) return Infinity;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

const FLAG_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  ADD: { label: "ADD", color: "var(--green)", bg: "var(--green-dim)" },
  EXIT: { label: "EXIT", color: "var(--red)", bg: "var(--red-dim)" },
  ERN: { label: "ERN", color: "var(--accent)", bg: "rgba(120,140,200,0.10)" },
  VOL: { label: "⚡", color: "var(--amber)", bg: "var(--amber-dim)" },
};

interface Props {
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
  earnings: LiveEarningsCalendarItem[];
}

export default function MoversCard({ holdings, watchlist, earnings }: Props) {
  const [period, setPeriod] = useState<Period>("1D");
  const isMobile = useIsMobile();
  const { priceData } = useDailyPrices();
  const watchlistTickerList = useMemo(
    () => Array.from(new Set(watchlist.map((w) => String(w.ticker || "").toUpperCase()).filter(Boolean))),
    [watchlist],
  );
  const { byTicker: wlHistory } = useWatchlistHistory(watchlistTickerList);

  // Earnings set for flag detection
  const earningsTickers = useMemo(() => {
    const set = new Set<string>();
    earnings.forEach((e) => {
      const d = daysUntil(e.nextEarningsDate);
      if (d >= 0 && d <= 1) set.add(e.ticker.toUpperCase());
    });
    return set;
  }, [earnings]);

  const ZONE_THRESHOLD = 0.15;

  const rows = useMemo(() => {
    const out: MoverRow[] = [];
    const seen = new Set<string>();

    // --- Holdings ---
    holdings.forEach((h) => {
      if (!h.ticker || h.price <= 0) return;
      const key = h.ticker.toUpperCase();
      if (seen.has(key)) {
        // Dedup: keep the one with larger absolute move
        const existing = out.find((r) => r.ticker.toUpperCase() === key);
        if (existing && Math.abs(existing.change) >= Math.abs(h.day ?? 0)) return;
        // Replace
        const idx = out.findIndex((r) => r.ticker.toUpperCase() === key);
        if (idx >= 0) out.splice(idx, 1);
      }
      seen.add(key);

      // Skip stale prices (same as prev close)
      if (h.prevClose != null && h.price === h.prevClose) return;

      const isBordier = String(h.account || "").toUpperCase().replace(/[^A-Z]/g, "").startsWith("BORDIER");
      const pd = priceData?.get(normaliseTicker(h.ticker));

      // Compute change for the selected period
      let change = h.day ?? 0;
      if (period === "1W" && pd && pd.points.length >= 5) {
        const idx5 = Math.max(0, pd.points.length - 6);
        const prev = pd.points[idx5]?.priceLocal;
        const latest = pd.points[pd.points.length - 1]?.priceLocal;
        if (prev && latest) change = ((latest - prev) / prev) * 100;
      } else if (period === "1M" && pd && pd.points.length >= 20) {
        const idx21 = Math.max(0, pd.points.length - 22);
        const prev = pd.points[idx21]?.priceLocal;
        const latest = pd.points[pd.points.length - 1]?.priceLocal;
        if (prev && latest) change = ((latest - prev) / prev) * 100;
      }

      // Doctrine flags
      const flags: string[] = [];
      const triggerAdd = parseFloat(String(h.trigger_price_add ?? ""));
      const triggerExit = parseFloat(String(h.trigger_price_exit ?? ""));
      if (!isNaN(triggerExit) && triggerExit > 0 && h.price <= triggerExit * (1 + ZONE_THRESHOLD)) flags.push("EXIT");
      else if (!isNaN(triggerAdd) && triggerAdd > 0 && h.price <= triggerAdd * (1 + ZONE_THRESHOLD)) flags.push("ADD");
      if (earningsTickers.has(key)) flags.push("ERN");

      // Sparkline points
      const sparkPoints = pd && pd.points.length >= 5 ? pd.points : null;
      const sparkColor = pd?.sparklineColor ?? (change >= 0 ? "green" : "red");

      out.push({
        ticker: h.ticker,
        price: h.price,
        change,
        mv: h.mv || 0,
        currency: h.currency,
        isWatchlist: false,
        isBordier,
        flags,
        sparkPoints,
        sparkColor,
      });
    });

    // --- Watchlist ---
    watchlist.forEach((w) => {
      if (!w.ticker) return;
      const key = w.ticker.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);

      const pd = priceData?.get(normaliseTicker(w.ticker));
      const traj = wlHistory[key];

      let last: number | null = null;
      let prev: number | null = null;

      // 1D change from daily_prices or watchlist history
      if (pd && pd.points.length >= 2) {
        last = pd.points[pd.points.length - 1].priceLocal;
        prev = pd.points[pd.points.length - 2].priceLocal;
      } else if (traj && traj.spark30d.length >= 2) {
        last = traj.spark30d[traj.spark30d.length - 1].close;
        prev = traj.spark30d[traj.spark30d.length - 2].close;
      }

      if (last == null || prev == null || !prev) return;

      let change = ((last - prev) / prev) * 100;

      if (period === "1W") {
        if (pd && pd.points.length >= 5) {
          const p5 = pd.points[Math.max(0, pd.points.length - 6)]?.priceLocal;
          if (p5) change = ((last - p5) / p5) * 100;
        } else if (traj?.price7dAgo) {
          change = ((last - traj.price7dAgo) / traj.price7dAgo) * 100;
        }
      } else if (period === "1M") {
        if (pd && pd.points.length >= 20) {
          const p21 = pd.points[Math.max(0, pd.points.length - 22)]?.priceLocal;
          if (p21) change = ((last - p21) / p21) * 100;
        } else if (traj?.price30dAgo) {
          change = ((last - traj.price30dAgo) / traj.price30dAgo) * 100;
        }
      }

      // Doctrine flags
      const flags: string[] = [];
      if (earningsTickers.has(key)) flags.push("ERN");

      const sparkPoints = pd && pd.points.length >= 5
        ? pd.points
        : traj && traj.spark30d.length >= 5
        ? traj.spark30d.map((p) => ({ date: p.date, priceLocal: p.close, priceGbp: p.close }))
        : null;
      const sparkColor = pd?.sparklineColor ?? (change >= 0 ? "green" : "red");

      out.push({
        ticker: w.ticker,
        price: typeof w.current === "number" ? w.current : last,
        change,
        mv: 0,
        currency: w.currency || "USD",
        isWatchlist: true,
        isBordier: false,
        flags,
        sparkPoints,
        sparkColor,
        entry: w.entry,
      });
    });

    // Sort by absolute change descending
    return out.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }, [holdings, watchlist, priceData, wlHistory, earningsTickers, period, ZONE_THRESHOLD]);

  const upCount = rows.filter((r) => r.change > 0).length;
  const downCount = rows.filter((r) => r.change < 0).length;

  const mp = isMobile ? "0 12px 8px" : "0 16px 8px";

  const segBase: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.1em",
    padding: "3px 8px",
    border: "1px solid var(--rim)",
    background: "transparent",
    color: "var(--text-dim)",
    cursor: "pointer",
    lineHeight: 1.4,
  };
  const segActive: React.CSSProperties = {
    background: "rgba(201,168,76,0.15)",
    color: "var(--gold)",
    borderColor: "rgba(201,168,76,0.4)",
  };

  return (
    <div style={card}>
      <div style={{ ...cardHeader, flexWrap: "wrap", gap: 8 }}>
        <span style={cardTitle}>Movers</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          {/* Period toggle */}
          <div role="group" aria-label="Period" style={{ display: "inline-flex" }}>
            {(["1D", "1W", "1M"] as const).map((opt, i) => (
              <button
                key={opt}
                type="button"
                onClick={() => setPeriod(opt)}
                aria-pressed={period === opt}
                style={{
                  ...segBase,
                  ...(period === opt ? segActive : null),
                  borderLeftWidth: i === 0 ? 1 : 0,
                  borderTopLeftRadius: i === 0 ? 2 : 0,
                  borderBottomLeftRadius: i === 0 ? 2 : 0,
                  borderTopRightRadius: i === 2 ? 2 : 0,
                  borderBottomRightRadius: i === 2 ? 2 : 0,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
          {/* Up/Down counts */}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em" }}>
            <span style={{ color: "var(--green)" }}>{upCount} ▲</span>
            <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
            <span style={{ color: "var(--red)" }}>{downCount} ▼</span>
          </span>
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{
        padding: mp,
        maxHeight: 360,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}>
        {rows.length === 0 ? (
          <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
            No price data available
          </div>
        ) : (
          rows.map((m) => {
            const currencySymbol = m.currency === "GBP" || m.currency === "GBX" ? "£" : m.currency === "EUR" ? "€" : m.currency === "SEK" ? "kr" : "$";
            const priceStr = `${currencySymbol}${m.price.toFixed(2)}`;
            const hasSpark = !!m.sparkPoints;

            if (isMobile) {
              return (
                <div key={m.ticker} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 0", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <TickerButton ticker={m.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", minWidth: 46 }}>
                      {m.ticker}
                    </TickerButton>
                    {m.isWatchlist && <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)", letterSpacing: "0.1em", border: "1px solid var(--rim)", padding: "0 3px", borderRadius: 1 }}>WL</span>}
                    {m.flags.map((f) => {
                      const s = FLAG_STYLE[f];
                      return s ? <span key={f} style={{ fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.08em", padding: "1px 4px", borderRadius: 2, color: s.color, background: s.bg }}>{s.label}</span> : null;
                    })}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", marginLeft: "auto" }}>{priceStr}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: m.change >= 0 ? "var(--green)" : "var(--red)", minWidth: 56, textAlign: "right" }}>
                      {m.change >= 0 ? "▲" : "▼"} {m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {hasSpark ? <Sparkline points={m.sparkPoints!} color={m.sparkColor} width={140} height={20} /> : <span style={{ width: 140 }} />}
                    {m.isWatchlist && m.entry ? (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@ {m.entry}</span>
                    ) : m.mv > 0 ? (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", flex: 1, textAlign: "right" }}>{formatCurrency(m.mv)}</span>
                    ) : null}
                  </div>
                </div>
              );
            }

            return (
              <div key={m.ticker} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
                <TickerButton ticker={m.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", minWidth: 50 }}>
                  {m.ticker}
                </TickerButton>
                {m.isWatchlist && <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)", letterSpacing: "0.1em", border: "1px solid var(--rim)", padding: "0 3px", borderRadius: 1 }}>WL</span>}
                {m.isBordier && <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--gold)", letterSpacing: "0.1em" }}>JPY</span>}
                {m.flags.map((f) => {
                  const s = FLAG_STYLE[f];
                  return s ? <span key={f} style={{ fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.08em", padding: "1px 4px", borderRadius: 2, color: s.color, background: s.bg }}>{s.label}</span> : null;
                })}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", minWidth: 70 }}>{priceStr}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: m.change >= 0 ? "var(--green)" : "var(--red)", minWidth: 68 }}>
                  {m.change >= 0 ? "▲" : "▼"} {m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}%
                </span>
                {hasSpark ? (
                  <Sparkline points={m.sparkPoints!} color={m.sparkColor} width={90} height={22} />
                ) : (
                  <span style={{ width: 90, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", opacity: 0.4, textAlign: "center" }}>—</span>
                )}
                {m.isWatchlist && m.entry ? (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.entry}>@ {m.entry}</span>
                ) : m.mv > 0 ? (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", flex: 1, textAlign: "right" }}>{formatCurrency(m.mv)}</span>
                ) : (
                  <span style={{ flex: 1 }} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
