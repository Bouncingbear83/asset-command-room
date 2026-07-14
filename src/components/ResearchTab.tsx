/**
 * ResearchTab — unified research index.
 *
 * Shows a grid of all scored tickers sourced from vault_notes_meta.
 * Clicking a card opens the FactSheet (which already renders vault thesis,
 * score evolution, session history, and all sheet/Supabase data).
 *
 * Tickers with bespoke HTML deep-dive reports get a badge; those reports
 * remain viewable via the ReportViewer when accessed through the badge.
 */
import { useMemo, useState } from "react";
import { useResearchIndex, type ResearchIndexEntry } from "@/hooks/useResearchIndex";
import { useFactSheet } from "@/components/factsheet/FactSheetProvider";
import ResearchCard from "./ResearchCard";
import ReportViewer from "./ReportViewer";

type StatusFilter = "all" | "held" | "watchlist" | "exited";
type SortField = "score" | "ticker" | "last_scored" | "layer";
type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortField, string> = {
  score: "Score",
  ticker: "Ticker",
  last_scored: "Last scored",
  layer: "Layer",
};

function matchesFilter(entry: ResearchIndexEntry, filter: StatusFilter): boolean {
  const s = entry.status;
  switch (filter) {
    case "all": return true;
    case "held": return s === "HELD";
    case "watchlist": return !!s && s !== "HELD" && s !== "EXITED" && s !== "REJECTED" && s !== "DORMANT";
    case "exited": return s === "EXITED" || s === "REJECTED" || s === "DORMANT";
  }
}

function sortValue(e: ResearchIndexEntry, field: SortField): string | number {
  switch (field) {
    case "score": return e.score ?? -1;
    case "ticker": return e.ticker;
    case "last_scored": return e.last_scored ? new Date(e.last_scored).getTime() : 0;
    case "layer": return e.layer || "zzz";
  }
}

export default function ResearchTab() {
  const { entries, loading, counts } = useResearchIndex();
  const { open: openFactSheet } = useFactSheet();

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [deepDiveId, setDeepDiveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let items = entries.filter((e) => matchesFilter(e, filter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (e) =>
          e.ticker.toLowerCase().includes(q) ||
          (e.name || "").toLowerCase().includes(q) ||
          (e.layer || "").toLowerCase().includes(q) ||
          (e.factor_group || "").toLowerCase().includes(q) ||
          (e.thesis_snippet || "").toLowerCase().includes(q)
      );
    }
    const dirMul = sortDir === "asc" ? 1 : -1;
    items.sort((a, b) => {
      const av = sortValue(a, sortField);
      const bv = sortValue(b, sortField);
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dirMul;
      return ((av as number) - (bv as number)) * dirMul;
    });
    return items;
  }, [entries, filter, sortField, sortDir, search]);

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "ticker" || field === "layer" ? "asc" : "desc");
    }
  };

  // Deep dive viewer mode
  if (deepDiveId) {
    return <ReportViewer reportId={deepDiveId} onBack={() => setDeepDiveId(null)} />;
  }

  const filterBtn = (f: StatusFilter, label: string, count: number) => {
    const active = filter === f;
    return (
      <button
        key={f}
        onClick={() => setFilter(f)}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          padding: "5px 12px",
          background: active ? "var(--surface)" : "transparent",
          border: active ? "1px solid var(--gold-dim)" : "1px solid var(--rim)",
          color: active ? "var(--gold)" : "var(--text-dim)",
          cursor: "pointer",
          transition: "all .15s",
        }}
      >
        {label} <span style={{ color: active ? "var(--text-mid)" : "var(--text-dim)", marginLeft: 4 }}>{count}</span>
      </button>
    );
  };

  return (
    <div style={{ padding: "24px var(--app-px, 40px)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--gold)", margin: 0 }}>
          Research
        </h2>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.15em" }}>
          {counts.total} TICKERS IN VAULT
        </span>
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {/* Status filters */}
        {filterBtn("all", "All", counts.total)}
        {filterBtn("held", "Held", counts.held)}
        {filterBtn("watchlist", "Pipeline", counts.watchlist)}
        {filterBtn("exited", "Exited", counts.exited)}

        {/* Spacer */}
        <div style={{ flex: 1, minWidth: 20 }} />

        {/* Search */}
        <input
          type="text"
          placeholder="Search tickers, names, thesis..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            padding: "6px 12px",
            background: "var(--panel)",
            border: "1px solid var(--rim)",
            color: "var(--text-mid)",
            minWidth: 200,
            maxWidth: 300,
            outline: "none",
          }}
        />

        {/* Sort */}
        <div style={{ display: "flex", gap: 4 }}>
          {(Object.keys(SORT_LABELS) as SortField[]).map((f) => {
            const active = sortField === f;
            const arrow = active ? (sortDir === "asc" ? " ▲" : " ▼") : "";
            return (
              <button
                key={f}
                onClick={() => toggleSort(f)}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "4px 8px",
                  background: "transparent",
                  border: "none",
                  color: active ? "var(--text-mid)" : "var(--text-dim)",
                  cursor: "pointer",
                }}
              >
                {SORT_LABELS[f]}{arrow}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>Loading vault index...</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
          {search ? `No matches for "${search}"` : "No tickers in vault."}
        </div>
      ) : (
        <div className="research-grid">
          {filtered.map((entry) => (
            <ResearchCard
              key={entry.ticker}
              entry={entry}
              onClick={() => {
                // If deep dive badge was clicked, we could handle that separately,
                // but for now: always open FactSheet. Deep dive is accessible from within.
                openFactSheet(entry.ticker);
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        .research-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 10px;
        }
        @media (max-width: 767px) {
          .research-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
