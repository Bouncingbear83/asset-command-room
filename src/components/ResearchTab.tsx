import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ReportCard from "./ReportCard";
import ReportViewer from "./ReportViewer";

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
}

export default function ResearchTab() {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("research_reports")
        .select("id, ticker, name, layer, score, tier, reclass_status, report_date, summary, prob_weighted_ev, spot_at_report, quartet_json")
        .order("report_date", { ascending: false });
      if (!error && data) setReports(data as ReportMeta[]);
      setLoading(false);
    })();
  }, []);

  if (selected) {
    return <ReportViewer reportId={selected} onClose={() => setSelected(null)} />;
  }

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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} onClick={() => setSelected(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
