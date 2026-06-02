import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  reportId: string;
  onBack: () => void;
}

interface FullReport {
  ticker: string;
  name: string | null;
  report_date: string;
  report_html: string;
}

export default function ReportViewer({ reportId, onBack }: Props) {
  const [report, setReport] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("research_reports")
        .select("ticker, name, report_date, report_html")
        .eq("id", reportId)
        .maybeSingle();
      if (!error && data) setReport(data as FullReport);
      setLoading(false);
    })();
  }, [reportId]);

  // Auto-resize iframe to fit content
  useEffect(() => {
    if (!report?.report_html || !iframeRef.current) return;
    const iframe = iframeRef.current;
    let observer: ResizeObserver | null = null;

    const resize = () => {
      try {
        const body = iframe.contentDocument?.body;
        const docEl = iframe.contentDocument?.documentElement;
        const height = Math.max(body?.scrollHeight ?? 0, docEl?.scrollHeight ?? 0);
        if (height) iframe.style.height = `${height + 40}px`;
      } catch {}
    };

    iframe.onload = () => {
      try {
        const body = iframe.contentDocument?.body;
        if (body) {
          observer = new ResizeObserver(resize);
          observer.observe(body);
          resize();
        }
      } catch {}
    };

    return () => observer?.disconnect();
  }, [report?.report_html]);

  return (
    <div style={{ padding: "24px var(--app-px, 40px)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "1px solid var(--rim)",
            color: "var(--text-dim)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.15em",
            padding: "6px 14px",
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          ← Back to reports
        </button>
        {report && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-dim)",
            }}
          >
            <span style={{ color: "var(--gold)" }}>{report.ticker}</span>
            {report.name && <> · {report.name}</>} · {report.report_date}
          </div>
        )}
      </div>

      {loading ? (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-dim)",
          }}
        >
          Loading report...
        </div>
      ) : !report ? (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--red, #ef4444)",
          }}
        >
          Report not found.
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          title={`Report ${report.ticker} ${report.report_date}`}
          srcDoc={report.report_html}
          sandbox="allow-same-origin"
          style={{
            width: "100%",
            border: "1px solid var(--rim)",
            background: "var(--panel)",
            display: "block",
          }}
        />
      )}
    </div>
  );
}
