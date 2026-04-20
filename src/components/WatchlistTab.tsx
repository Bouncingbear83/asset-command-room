import { useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { LiveWatchItem, LiveMacroState } from "@/hooks/usePortfolioData";
import { parseEntryTarget } from "@/lib/parseEntryTarget";
import { useWatchlistHistory } from "@/hooks/useWatchlistHistory";
import { useWatchlistScores } from "@/hooks/useWatchlistScores";
import { WatchlistCard, type DerivedRow, type ZoneStatus } from "./watchlist/WatchlistCard";
import { buildSubstrateAuditPrompt, CLAUDE_PROJECT_URL } from "@/lib/claudePrompts";

interface Props {
  liveData: LiveWatchItem[];
  macroState: LiveMacroState;
}

const OVERDUE_DAYS = 14;

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Research row (compact, with rationale + Substrate Audit) ──
function ResearchRow({ row }: { row: DerivedRow }) {
  const { item } = row;
  const handleAudit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prompt = buildSubstrateAuditPrompt(item.ticker);
    const url = `${CLAUDE_PROJECT_URL}?prompt=${encodeURIComponent(prompt)}`;
    (window.top || window).open(url, "_blank");
  };
  return (
    <div style={{ padding: "10px 18px 8px", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 60 }}>
          {item.ticker}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", flex: "1 1 200px" }}>
          {item.name}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
          {row.daysSinceReview != null ? `Reviewed ${row.daysSinceReview}d ago` : "Never reviewed"}
        </span>
        <button
          onClick={handleAudit}
          style={{
            background: "none",
            border: "1px solid var(--rim)",
            color: "rgb(170,140,220)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            padding: "3px 9px",
            borderRadius: 2,
            cursor: "pointer",
          }}
        >
          🔬 Substrate Audit →
        </button>
      </div>
      {item.rationale && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            color: "var(--text-dim)",
            lineHeight: 1.55,
            marginTop: 4,
            paddingLeft: 72,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {item.rationale}
        </div>
      )}
    </div>
  );
}

// ── Section header ──

function SectionHeader({
  label,
  count,
  dotColor,
  collapsible,
  expanded,
  onToggle,
}: {
  label: string;
  count: number;
  dotColor: string;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const isMobile = useIsMobile();
  return (
    <div
      onClick={collapsible ? onToggle : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: isMobile ? "10px 14px" : "12px 18px",
        borderBottom: "1px solid var(--rim)",
        cursor: collapsible ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: dotColor,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>· {count}</span>
      {collapsible && (
        <span style={{ marginLeft: "auto", color: "var(--text-dim)" }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      )}
    </div>
  );
}

// ── Empty section line ──

function EmptyLine({ label, dotColor }: { label: string; dotColor: string }) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: isMobile ? "8px 14px" : "10px 18px",
        background: "var(--panel)",
        border: "1px solid var(--rim)",
        borderRadius: 3,
        marginBottom: 10,
        opacity: 0.55,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.15em" }}>
        {label}
      </span>
    </div>
  );
}

// ── Skeleton ──

function SkeletonRow() {
  return (
    <div
      style={{
        padding: "14px 18px",
        borderBottom: "1px solid rgba(28,28,48,0.4)",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ width: 80, height: 12, background: "var(--rim)", borderRadius: 2, animation: "pulse-alert 1.6s ease-in-out infinite" }} />
      <div style={{ flex: 1, height: 10, background: "var(--rim)", borderRadius: 2, opacity: 0.6 }} />
      <div style={{ width: 180, height: 40, background: "var(--rim)", borderRadius: 2, opacity: 0.5 }} />
      <div style={{ width: 80, height: 10, background: "var(--rim)", borderRadius: 2, opacity: 0.6 }} />
    </div>
  );
}

// ── Page ──

export default function WatchlistTab({ liveData, macroState }: Props) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [waitingExpanded, setWaitingExpanded] = useState(false);
  const [preIpoExpanded, setPreIpoExpanded] = useState(false);

  // Pull tickers for batched Supabase fetches
  const allTickers = useMemo(
    () =>
      Array.from(
        new Set(
          liveData
            .map((d) => d.ticker?.trim().toUpperCase())
            .filter((t): t is string => !!t),
        ),
      ),
    [liveData],
  );

  const { byTicker: traj, loading: trajLoading } = useWatchlistHistory(allTickers);
  const { byTicker: scoresByTicker } = useWatchlistScores(allTickers);

  // Layer + status filter options
  const layerOptions = useMemo(
    () => Array.from(new Set(liveData.map((d) => d.layer).filter(Boolean))).sort(),
    [liveData],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(liveData.map((d) => d.status?.trim().toUpperCase()).filter(Boolean))).sort(),
    [liveData],
  );

  // ── Derive every row ──
  const derived: DerivedRow[] = useMemo(() => {
    return liveData.map((item) => {
      const ticker = item.ticker?.trim().toUpperCase() ?? "";
      const trajectory = traj[ticker] ?? null;
      const score = scoresByTicker[ticker] ?? null;

      const zone = parseEntryTarget(item.entry, item.triggerPriceNumeric);

      // Prefer Supabase live close, fall back to sheet's CURRENT PRICE
      const currentPrice = trajectory?.currentClose ?? item.current ?? null;

      let zoneStatus: ZoneStatus;
      if (currentPrice == null) zoneStatus = "PRE_IPO";
      else if (!zone) zoneStatus = "WAITING";
      else if (currentPrice <= zone.high && currentPrice >= zone.low) zoneStatus = "IN_ZONE";
      else if (currentPrice <= zone.high * 1.10) zoneStatus = "APPROACHING";
      else zoneStatus = "WAITING";

      const distanceToEntryPct =
        currentPrice != null && zone && zone.high > 0
          ? ((currentPrice - zone.high) / zone.high) * 100
          : null;

      const change7dPct =
        trajectory?.currentClose != null && trajectory?.price7dAgo != null && trajectory.price7dAgo > 0
          ? ((trajectory.currentClose - trajectory.price7dAgo) / trajectory.price7dAgo) * 100
          : null;
      const change30dPct =
        trajectory?.currentClose != null && trajectory?.price30dAgo != null && trajectory.price30dAgo > 0
          ? ((trajectory.currentClose - trajectory.price30dAgo) / trajectory.price30dAgo) * 100
          : null;

      const days = daysSince(item.triggerReviewDate);
      const isOverdue = days != null && days > OVERDUE_DAYS;

      return {
        item,
        zone,
        zoneStatus,
        distanceToEntryPct,
        change7dPct,
        change30dPct,
        daysSinceReview: days,
        isOverdue,
        trajectory,
        score,
      };
    });
  }, [liveData, traj, scoresByTicker]);

  // Apply search + filter chips
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return derived.filter((r) => {
      if (q && !`${r.item.ticker} ${r.item.name}`.toLowerCase().includes(q)) return false;
      if (layerFilter !== "ALL" && r.item.layer !== layerFilter) return false;
      if (statusFilter !== "ALL" && r.item.status?.trim().toUpperCase() !== statusFilter) return false;
      return true;
    });
  }, [derived, search, layerFilter, statusFilter]);

  // ── Bucket rows ──
  const inZone = useMemo(
    () => filtered.filter((r) => r.zoneStatus === "IN_ZONE"),
    [filtered],
  );

  const approaching = useMemo(
    () =>
      filtered
        .filter((r) => r.zoneStatus === "APPROACHING")
        .sort((a, b) => (a.distanceToEntryPct ?? 999) - (b.distanceToEntryPct ?? 999)),
    [filtered],
  );

  // Overdue: independent of zone, but exclude EXITED / PRE-IPO / RESEARCH / MONITOR
  const overdue = useMemo(() => {
    const skipStatus = new Set(["EXITED", "PRE-IPO", "RESEARCH", "MONITOR"]);
    return filtered
      .filter((r) => r.isOverdue && !skipStatus.has(r.item.status?.trim().toUpperCase()))
      .sort((a, b) => (b.daysSinceReview ?? 0) - (a.daysSinceReview ?? 0));
  }, [filtered]);

  const overdueIds = useMemo(() => new Set(overdue.map((r) => r.item.ticker)), [overdue]);

  // Waiting: priced & WAITING & not already shown above
  const waiting = useMemo(() => {
    const skipStatus = new Set(["MONITOR", "RESEARCH", "PRE-IPO", "EXITED"]);
    return filtered
      .filter(
        (r) =>
          r.zoneStatus === "WAITING" &&
          !overdueIds.has(r.item.ticker) &&
          !skipStatus.has(r.item.status?.trim().toUpperCase()),
      )
      .sort((a, b) => {
        // Score desc if both have scores; otherwise gap asc
        const sa = a.score?.total_score ?? null;
        const sb = b.score?.total_score ?? null;
        if (sa != null && sb != null && sa !== sb) return sb - sa;
        return (a.distanceToEntryPct ?? 999) - (b.distanceToEntryPct ?? 999);
      });
  }, [filtered, overdueIds]);

  // Group waiting by layer
  const waitingByLayer = useMemo(() => {
    const groups = new Map<string, DerivedRow[]>();
    for (const r of waiting) {
      const layer = r.item.layer || "—";
      if (!groups.has(layer)) groups.set(layer, []);
      groups.get(layer)!.push(r);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [waiting]);

  const monitoring = useMemo(
    () =>
      filtered
        .filter((r) => r.item.status?.trim().toUpperCase() === "MONITOR")
        .sort((a, b) => a.item.ticker.localeCompare(b.item.ticker)),
    [filtered],
  );
  const research = useMemo(() => {
    // MONITORING wins: exclude any ticker already shown in MONITORING
    const monitorTickers = new Set(
      monitoring.map((r) => r.item.ticker.trim().toUpperCase()),
    );
    return filtered
      .filter((r) => r.item.status?.trim().toUpperCase() === "RESEARCH")
      .filter((r) => !monitorTickers.has(r.item.ticker.trim().toUpperCase()))
      .sort((a, b) => a.item.ticker.localeCompare(b.item.ticker));
  }, [filtered, monitoring]);
  const preIpo = useMemo(
    () =>
      filtered
        .filter((r) => r.item.status?.trim().toUpperCase() === "PRE-IPO")
        .sort((a, b) => a.item.ticker.localeCompare(b.item.ticker)),
    [filtered],
  );

  // Header counts (live, not bucketed — recomputed from `derived` so they reflect entire watchlist regardless of filters)
  const counts = useMemo(() => {
    const total = derived.length;
    const inZ = derived.filter((r) => r.zoneStatus === "IN_ZONE").length;
    const appr = derived.filter((r) => r.zoneStatus === "APPROACHING").length;
    const od = derived.filter((r) => {
      const skip = new Set(["EXITED", "PRE-IPO", "RESEARCH", "MONITOR"]);
      return r.isOverdue && !skip.has(r.item.status?.trim().toUpperCase());
    }).length;
    return { total, inZ, appr, od };
  }, [derived]);

  const pauseActive = (macroState["PAUSE_ACTIVE"]?.currentValue || "").trim().toUpperCase() === "YES";

  // ── Empty data state ──
  if (!liveData || liveData.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
          Watchlist data unavailable. Check Google Sheets connection.
        </p>
      </div>
    );
  }

  // ── Render ──

  const sectionStyle: CSSProperties = {
    background: "var(--panel)",
    border: "1px solid var(--rim)",
    borderRadius: 3,
    marginBottom: 14,
    overflow: "hidden",
  };

  return (
    <div>
      {/* ── Sticky header strip ── */}
      <div
        style={{
          position: "sticky",
          top: isMobile ? 84 : 84,
          zIndex: 10,
          background: "var(--void)",
          borderBottom: "1px solid var(--rim)",
          padding: isMobile ? "10px 14px" : "12px 18px",
          marginBottom: 16,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          gap: isMobile ? 10 : 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 18, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "var(--gold)" }}>
            WATCHLIST
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
            {counts.total} total ·{" "}
            <span style={{ color: counts.inZ > 0 ? "var(--green)" : "var(--text-dim)", fontWeight: counts.inZ > 0 ? 700 : 400 }}>
              {counts.inZ} IN ZONE
            </span>{" "}
            ·{" "}
            <span style={{ color: counts.appr > 0 ? "var(--amber)" : "var(--text-dim)" }}>
              {counts.appr} APPROACHING
            </span>{" "}
            ·{" "}
            <span style={{ color: counts.od > 0 ? "var(--red)" : "var(--text-dim)" }}>
              {counts.od} OVERDUE
            </span>
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flex: isMobile ? "1 1 auto" : "1 1 auto", justifyContent: isMobile ? "stretch" : "flex-end", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: isMobile ? "1 1 100%" : "1 1 200px", maxWidth: isMobile ? "none" : 280 }}>
            <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticker or name…"
              aria-label="Search watchlist"
              style={{
                width: "100%",
                padding: "6px 8px 6px 26px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--rim)",
                color: "var(--text-mid)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                borderRadius: 2,
                outline: "none",
              }}
            />
          </div>
          <select
            value={layerFilter}
            onChange={(e) => setLayerFilter(e.target.value)}
            style={selectStyle}
            aria-label="Filter by layer"
          >
            <option value="ALL">Layer · All</option>
            {layerOptions.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectStyle}
            aria-label="Filter by status"
          >
            <option value="ALL">Status · All</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {pauseActive && (
        <div
          style={{
            background: "var(--red-dim)",
            border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
            padding: "8px 14px",
            borderRadius: 2,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--red)",
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          ⛔ MACRO PAUSE ACTIVE — NO NEW BUYS
        </div>
      )}

      {/* ── 1. IN ZONE ── */}
      {inZone.length > 0 ? (
        <div style={sectionStyle}>
          <SectionHeader label="In Zone" count={inZone.length} dotColor="var(--green)" />
          {inZone.map((r) => (
            <WatchlistCard key={`zone-${r.item.ticker}`} row={r} variant="full" tint="in-zone" />
          ))}
        </div>
      ) : (
        <EmptyLine label="No tickers in buy zone" dotColor="var(--green)" />
      )}

      {/* ── 2. APPROACHING ── */}
      {approaching.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader label="Approaching (within 10%)" count={approaching.length} dotColor="var(--amber)" />
          {approaching.map((r) => (
            <WatchlistCard key={`appr-${r.item.ticker}`} row={r} variant="full" tint="approaching" />
          ))}
        </div>
      )}

      {/* ── 3. OVERDUE REVIEWS ── */}
      {overdue.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader label="Overdue Reviews" count={overdue.length} dotColor="var(--red)" />
          {overdue.map((r) => (
            <WatchlistCard key={`od-${r.item.ticker}`} row={r} variant="compact" tint="overdue" />
          ))}
        </div>
      )}

      {/* ── 4. WAITING (collapsed by default) ── */}
      {waiting.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader
            label="Waiting"
            count={waiting.length}
            dotColor="var(--text-dim)"
            collapsible
            expanded={waitingExpanded}
            onToggle={() => setWaitingExpanded((v) => !v)}
          />
          {waitingExpanded &&
            waitingByLayer.map(([layer, rows]) => (
              <div key={`wait-${layer}`}>
                <div
                  style={{
                    padding: "8px 18px",
                    background: "rgba(0,0,0,0.2)",
                    borderBottom: "1px solid var(--rim)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    color: "var(--text-dim)",
                    textTransform: "uppercase",
                  }}
                >
                  {layer} · {rows.length}
                </div>
                {rows.map((r) => (
                  <WatchlistCard key={`wait-${r.item.ticker}`} row={r} variant="compact" />
                ))}
              </div>
            ))}
        </div>
      )}

      {/* ── 5. MONITORING ── */}
      {monitoring.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader label="Monitoring" count={monitoring.length} dotColor="var(--accent)" />
          {monitoring.map((r) => (
            <WatchlistCard key={`mon-${r.item.ticker}`} row={r} variant="compact" hideActions />
          ))}
        </div>
      )}

      {/* ── 6. RESEARCH ── */}
      {research.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader label="Research" count={research.length} dotColor="rgb(140,140,220)" />
          {research.map((r) => (
            <ResearchRow key={`res-${r.item.ticker}`} row={r} />
          ))}
        </div>
      )}

      {/* ── 7. PRE-IPO (collapsed) ── */}
      {preIpo.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader
            label="Pre-IPO"
            count={preIpo.length}
            dotColor="rgb(170,120,220)"
            collapsible
            expanded={preIpoExpanded}
            onToggle={() => setPreIpoExpanded((v) => !v)}
          />
          {preIpoExpanded &&
            preIpo.map((r) => (
              <div
                key={`pre-${r.item.ticker}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 18px",
                  borderBottom: "1px solid rgba(28,28,48,0.4)",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 60 }}>
                  {r.item.ticker}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", flex: "1 1 200px" }}>
                  {r.item.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 8,
                    letterSpacing: "0.12em",
                    padding: "2px 7px",
                    borderRadius: 2,
                    background: "rgba(28,28,48,0.5)",
                    border: "1px solid var(--rim)",
                    color: "var(--text-dim)",
                  }}
                >
                  {r.item.layer}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "rgb(170,120,220)",
                    background: "rgba(170,120,220,0.1)",
                    padding: "2px 7px",
                    borderRadius: 2,
                  }}
                >
                  Awaiting IPO
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Loading hint when sparkline data is still being fetched */}
      {trajLoading && (
        <div style={{ marginTop: 12 }}>
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}
    </div>
  );
}

const selectStyle: CSSProperties = {
  background: "rgba(0,0,0,0.3)",
  border: "1px solid var(--rim)",
  color: "var(--text-mid)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  padding: "6px 8px",
  borderRadius: 2,
  outline: "none",
  cursor: "pointer",
};
