import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { useActionTracker, type ActionItem } from "./useActionTracker";
import ActionItemRow from "./ActionItem";
import ActionAddModal from "./ActionAddModal";

type FilterMode = "ALL" | "OPEN" | "RESOLVED";

function daysUntil(due: string): number {
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

interface Group {
  label: string;
  items: ActionItem[];
  accent?: string;
}

export default function ActionsTab() {
  const { watchlist, holdings, earningsCalendar } = usePortfolioData();
  const { items, loading, resolve, snooze, reopen, addManual, remove, updateNote } = useActionTracker({
    watchlist,
    holdings,
    earnings: earningsCalendar,
  });

  const [filter, setFilter] = useState<FilterMode>("OPEN");
  const [tickerFilter, setTickerFilter] = useState<string>("");
  const [layerFilter, setLayerFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  // Read URL params for deep-linking (?ticker=SGL.DE&type=EARNINGS_GATE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));

    const t = params.get("ticker") || hashParams.get("ticker") || "";
    const l = params.get("layer") || hashParams.get("layer") || "";
    const tp = params.get("type") || hashParams.get("type") || "";
    const fk = params.get("action") || hashParams.get("action") || "";

    if (t) setTickerFilter(t.toUpperCase());
    if (l) setLayerFilter(l);
    if (tp) setTypeFilter(tp);
    if (fk) setFocusKey(fk);
  }, []);

  // If focus is on a resolved item, ensure filter includes it
  useEffect(() => {
    if (!focusKey) return;
    const target = items.find((i) => i.dedupe_key === focusKey || i.id === focusKey);
    if (target && (target.status === "CONFIRMED" || target.status === "DISMISSED") && filter === "OPEN") {
      setFilter("ALL");
    }
  }, [focusKey, items, filter]);

  // Distinct values for filter dropdowns
  const tickerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.ticker) set.add(it.ticker.toUpperCase());
    return Array.from(set).sort();
  }, [items]);

  const layerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.layer) set.add(it.layer);
    // Also pull from holdings/watchlist for broader coverage
    for (const h of holdings) if (h.layer) set.add(h.layer);
    for (const w of watchlist) if (w.layer) set.add(w.layer);
    return Array.from(set).sort();
  }, [items, holdings, watchlist]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.action_type);
    return Array.from(set).sort();
  }, [items]);

  // All ticker options for the add modal
  const allTickers = useMemo(() => {
    const set = new Set<string>();
    for (const h of holdings) if (h.ticker) set.add(h.ticker.toUpperCase());
    for (const w of watchlist) if (w.ticker) set.add(w.ticker.toUpperCase());
    return Array.from(set).sort();
  }, [holdings, watchlist]);

  const openCount = useMemo(() => items.filter((i) => i.status === "OPEN").length, [items]);

  const groups: Group[] = useMemo(() => {
    const visible = items.filter((i) => {
      // Status filter
      if (filter === "OPEN" && i.status !== "OPEN") return false;
      if (filter === "RESOLVED" && i.status !== "CONFIRMED" && i.status !== "DISMISSED") return false;
      // Ticker filter
      if (tickerFilter && (i.ticker || "").toUpperCase() !== tickerFilter.toUpperCase()) return false;
      // Layer filter
      if (layerFilter && (i.layer || "") !== layerFilter) return false;
      // Type filter
      if (typeFilter && i.action_type !== typeFilter) return false;
      return true;
    });

    const overdue: ActionItem[] = [];
    const week: ActionItem[] = [];
    const month: ActionItem[] = [];
    const later: ActionItem[] = [];

    for (const it of visible) {
      const diff = daysUntil(it.due_date);
      const isOpen = it.status === "OPEN";
      if (diff < 0 && isOpen) overdue.push(it);
      else if (diff <= 7) week.push(it);
      else if (diff <= 30) month.push(it);
      else later.push(it);
    }

    const sortFn = (a: ActionItem, b: ActionItem) => {
      const ra = a.status === "OPEN" ? 0 : 1;
      const rb = b.status === "OPEN" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return a.due_date.localeCompare(b.due_date);
    };
    [overdue, week, month, later].forEach((g) => g.sort(sortFn));

    return [
      { label: "Overdue", items: overdue, accent: "var(--red)" },
      { label: "This Week", items: week, accent: "var(--amber)" },
      { label: "This Month", items: month },
      { label: "Later", items: later },
    ].filter((g) => g.items.length > 0);
  }, [items, filter, tickerFilter, layerFilter, typeFilter]);

  const hasAnyFilter = tickerFilter || layerFilter || typeFilter;

  const chipStyle = (active: boolean): CSSProperties => ({
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.15em",
    padding: "5px 12px",
    border: `1px solid ${active ? "rgba(201,168,76,0.4)" : "var(--rim)"}`,
    background: active ? "var(--gold-dim, rgba(201,168,76,0.12))" : "transparent",
    color: active ? "var(--gold)" : "var(--text-dim)",
    cursor: "pointer",
    borderRadius: 2,
    textTransform: "uppercase",
  });

  const selectStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.1em",
    padding: "5px 8px",
    background: "var(--void)",
    border: "1px solid var(--rim)",
    color: "var(--text)",
    borderRadius: 2,
    cursor: "pointer",
    minWidth: 90,
    maxWidth: 140,
  };

  return (
    <div style={{ padding: "16px var(--app-px, 40px) 40px" }}>
      {/* ── Top bar: status chips + filters + add ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Left: status chips */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button style={chipStyle(filter === "ALL")} onClick={() => setFilter("ALL")}>ALL</button>
          <button style={chipStyle(filter === "OPEN")} onClick={() => setFilter("OPEN")}>
            OPEN{openCount > 0 ? ` (${openCount})` : ""}
          </button>
          <button style={chipStyle(filter === "RESOLVED")} onClick={() => setFilter("RESOLVED")}>RESOLVED</button>
        </div>

        {/* Centre: dimension filters */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select
            style={selectStyle}
            value={tickerFilter}
            onChange={(e) => setTickerFilter(e.target.value)}
          >
            <option value="">All tickers</option>
            {tickerOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            style={selectStyle}
            value={layerFilter}
            onChange={(e) => setLayerFilter(e.target.value)}
          >
            <option value="">All layers</option>
            {layerOptions.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <select
            style={selectStyle}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>

          {hasAnyFilter && (
            <button
              onClick={() => { setTickerFilter(""); setLayerFilter(""); setTypeFilter(""); }}
              style={{
                background: "none",
                border: "none",
                color: "var(--red)",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.1em",
                cursor: "pointer",
                padding: "4px 6px",
              }}
            >
              CLEAR ×
            </button>
          )}
        </div>

        {/* Right: add button */}
        <button
          onClick={() => setShowAdd(true)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.15em",
            padding: "5px 12px",
            border: "1px solid rgba(201,168,76,0.4)",
            background: "var(--gold-dim, rgba(201,168,76,0.12))",
            color: "var(--gold)",
            cursor: "pointer",
            borderRadius: 2,
          }}
        >
          + ADD
        </button>
      </div>

      {loading && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
          Loading…
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-dim)",
            padding: 20,
            textAlign: "center",
            border: "1px solid var(--rim)",
          }}
        >
          {hasAnyFilter
            ? `No actions matching filters.`
            : `No actions ${filter === "OPEN" ? "open" : filter.toLowerCase()}.`}
        </div>
      )}

      {groups.map((g) => {
        const openInGroup = g.items.filter((i) => i.status === "OPEN").length;
        return (
          <div
            key={g.label}
            style={{
              marginBottom: 20,
              borderLeft: g.accent ? `2px solid ${g.accent}` : "none",
              paddingLeft: g.accent ? 10 : 0,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: g.accent || "var(--text-mid)",
                padding: "6px 0",
                marginBottom: 4,
              }}
            >
              <span>{g.label}</span>
              <span>
                {openInGroup} OPEN · {g.items.length} TOTAL
              </span>
            </div>
            <div style={{ border: "1px solid var(--rim)", background: "var(--panel)" }}>
              {g.items.map((it) => (
                <ActionItemRow
                  key={it.id}
                  item={it}
                  onResolve={resolve}
                  onSnooze={snooze}
                  onReopen={reopen}
                  onDelete={remove}
                  onUpdateNote={updateNote}
                  focused={!!focusKey && (it.dedupe_key === focusKey || it.id === focusKey)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {showAdd && (
        <ActionAddModal
          tickerOptions={allTickers}
          onClose={() => setShowAdd(false)}
          onSubmit={addManual}
        />
      )}
    </div>
  );
}
