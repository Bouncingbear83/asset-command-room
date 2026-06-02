import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FullReport {
  id: string;
  ticker: string;
  name: string | null;
  report_date: string;
  report_html: string;
}

export default function ReportViewer({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const [report, setReport] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("research_reports")
        .select("id, ticker, name, report_date, report_html")
        .eq("id", reportId)
        .single();
      if (!error && data) setReport(data as FullReport);
      setLoading(false);
    })();
  }, [reportId]);

  return (
    <div style={{ padding: "24px var(--app-px, 40px)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "1px solid var(--rim)",
            color: "var(--text-dim)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.15em",
            padding: "4px 12px",
            cursor: "pointer",
          }}
        >
          ← BACK
        </button>
        {report && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
            <span style={{ color: "var(--gold)" }}>{report.ticker}</span>
            {report.name && <> · {report.name}</>} · {report.report_date}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>Loading...</div>
      ) : !report ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)" }}>Report not found.</div>
      ) : (
        <iframe
          title={`Report ${report.ticker} ${report.report_date}`}
          srcDoc={report.report_html}
          sandbox="allow-same-origin"
          style={{
            width: "100%",
            height: "calc(100vh - 200px)",
            border: "1px solid var(--rim)",
            background: "var(--panel)",
          }}
        />
      )}
    </div>
  );
}
