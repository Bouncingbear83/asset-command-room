import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ReportRow from "./ReportRow";
import ReportViewer from "./ReportViewer";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { parseConclusion } from "@/lib/parseConclusion";

export interface ReportMeta {
  id: string;
  ticker: string;
  name: string | null;
  layer: string | null;
  score: number | null;
  tier: string | null;
  reclass_status: string | null;
  report_date: string;
  summary: string | null;
  prob_weighted_ev: number | null;
  spot_at_report: number | null;
  quartet_json: { bb: number; bs: number; bw: number; bf: number } | null;
  version: number | null;
}

type SortField = "ticker" | "conclusion" | "score" | "report_date" | "delta";
type SortDir = "asc" | "desc";

const headerLabels: Record<SortField, string> = {
  ticker: "Ticker",
  conclusion: "Conclusion",
  score: "Score",
  report_date: "Report Date",
  delta: "Δ Since",
};

export default function ResearchTab() {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("report_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { holdings, watchlist } = usePortfolioData();

  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of holdings) {
      const t = h.ticker?.trim().toLowerCase();
      if (t && Number.isFinite(h.price as number) && (h.price as number) > 0) m.set(t, h.price as number);
    }
    for (const w of watchlist) {
      const t = w.ticker?.trim().toLowerCase();
      if (t && !m.has(t) && Number.isFinite(w.current) && w.current > 0) m.set(t, w.current);
    }
    return m;
  }, [holdings, watchlist]);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("research_reports")
        .select("id, ticker, name, layer, score, tier, reclass_status, report_date, summary, prob_weighted_ev, spot_at_report, quartet_json, version")
        .eq("is_latest", true)
        .order("report_date", { ascending: false });
      if (!error && data) setReports(data as ReportMeta[]);
      setLoading(false);
    })();
  }, []);

  const sortedReports = useMemo(() => {
    const dirMul = sortDir === "asc" ? 1 : -1;
    const rows = reports.slice();
    rows.sort((a, b) => {
      const av = sortValue(a, sortField, priceMap);
      const bv = sortValue(b, sortField, priceMap);
      // Nulls last regardless of direction
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dirMul;
      return ((av as number) - (bv as number)) * dirMul;
    });
    return rows;
  }, [reports, sortField, sortDir, priceMap]);

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "ticker" || field === "conclusion" ? "asc" : "desc");
    }
  };

  if (selected) {
    return <ReportViewer reportId={selected} onBack={() => setSelected(null)} />;
  }

  const sortBtn = (field: SortField) => {
    const active = sortField === field;
    const arrow = active ? (sortDir === "asc" ? " ▲" : " ▼") : "";
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: active ? "var(--text-mid)" : "var(--text-dim)",
          textAlign: "left",
          width: "100%",
        }}
      >
        {headerLabels[field]}{arrow}
      </button>
    );
  };

  return (
    <div style={{ padding: "24px var(--app-px, 40px)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--gold)", margin: 0 }}>
          Research Reports
        </h2>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.15em" }}>
          {reports.length} REPORTS
        </span>
      </div>

      {loading ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>Loading...</div>
      ) : reports.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>No reports yet.</div>
      ) : (
        <>
          {/* Header row — desktop only, matches ReportRow grid */}
          <div
            className="research-table-header"
            style={{
              display: "grid",
              gridTemplateColumns: "180px 90px 60px 88px 110px 1fr 24px",
              gap: 16,
              padding: "8px 16px",
              borderBottom: "1px solid var(--rim)",
              marginBottom: 8,
              alignItems: "center",
            }}
          >
            <div>{sortBtn("ticker")}</div>
            <div>{sortBtn("conclusion")}</div>
            <div style={{ textAlign: "right" }}>{sortBtn("score")}</div>
            <div>{sortBtn("report_date")}</div>
            <div style={{ textAlign: "right" }}>{sortBtn("delta")}</div>
            <div />
            <div />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedReports.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                livePrice={priceMap.get(r.ticker.trim().toLowerCase()) ?? null}
                onClick={() => setSelected(r.id)}
              />
            ))}
          </div>

          {/* Mobile sort fallback */}
          <div className="research-mobile-sort" style={{ marginTop: 16, display: "none" }}>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Sort{" "}
              <select
                value={`${sortField}:${sortDir}`}
                onChange={(e) => {
                  const [f, d] = e.target.value.split(":");
                  setSortField(f as SortField);
                  setSortDir(d as SortDir);
                }}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  padding: "5px 8px",
                  background: "var(--panel)",
                  color: "var(--text-mid)",
                  border: "1px solid var(--rim)",
                  marginLeft: 6,
                }}
              >
                <option value="report_date:desc">Report date ↓</option>
                <option value="report_date:asc">Report date ↑</option>
                <option value="conclusion:asc">Conclusion A→Z</option>
                <option value="delta:desc">Δ Since ↓</option>
                <option value="delta:asc">Δ Since ↑</option>
                <option value="score:desc">Score ↓</option>
                <option value="score:asc">Score ↑</option>
                <option value="ticker:asc">Ticker A→Z</option>
              </select>
            </label>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 767px) {
          .research-table-header { display: none !important; }
          .research-mobile-sort { display: block !important; }
        }
      `}</style>
    </div>
  );
}

function sortValue(r: ReportMeta, field: SortField, priceMap: Map<string, number>): string | number | null {
  switch (field) {
    case "ticker":
      return r.ticker?.toUpperCase() ?? null;
    case "conclusion":
      return parseConclusion(r.summary, null) ?? null;
    case "score":
      return r.score ?? null;
    case "report_date": {
      const t = Date.parse(r.report_date);
      return Number.isFinite(t) ? t : null;
    }
    case "delta": {
      const live = priceMap.get(r.ticker?.trim().toLowerCase() ?? "");
      if (live == null || r.spot_at_report == null || Number(r.spot_at_report) === 0) return null;
      return (live - Number(r.spot_at_report)) / Number(r.spot_at_report);
    }
  }
}
