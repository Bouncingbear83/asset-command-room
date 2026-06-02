import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  reportId: string;
  onBack: () => void;
}

interface FullReport {
  id: string;
  ticker: string;
  name: string | null;
  report_date: string;
  report_html: string;
  version: number | null;
  is_latest: boolean | null;
}

interface VersionMeta {
  id: string;
  version: number | null;
  report_date: string;
  is_latest: boolean | null;
}

export default function ReportViewer({ reportId, onBack }: Props) {
  const [report, setReport] = useState<FullReport | null>(null);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState(reportId);
  const [menuOpen, setMenuOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setCurrentId(reportId);
  }, [reportId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("research_reports")
        .select("id, ticker, name, report_date, report_html, version, is_latest")
        .eq("id", currentId)
        .maybeSingle();
      if (!error && data) setReport(data as FullReport);
      setLoading(false);
    })();
  }, [currentId]);

  // Fetch all versions for this ticker
  useEffect(() => {
    if (!report?.ticker) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("research_reports")
        .select("id, version, report_date, is_latest")
        .eq("ticker", report.ticker)
        .order("version", { ascending: false });
      if (data) setVersions(data as VersionMeta[]);
    })();
  }, [report?.ticker]);

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

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [menuOpen]);

  return (
    <div style={{ padding: "24px var(--app-px, 40px)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
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
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-dim)",
            }}
          >
            <span style={{ color: "var(--gold)" }}>{report.ticker}</span>
            {report.name && <span>· {report.name}</span>}
            <span>· {report.report_date}</span>

            {versions.length > 0 && (
              <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  style={{
                    background: "var(--panel)",
                    border: "1px solid var(--rim)",
                    color: "var(--gold)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    padding: "6px 10px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  v{report.version ?? "—"}
                  {report.is_latest && (
                    <span style={{ color: "var(--text-dim)", fontSize: 9 }}>· LATEST</span>
                  )}
                  <span style={{ color: "var(--text-dim)" }}>▾</span>
                </button>
                {menuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      right: 0,
                      minWidth: 220,
                      background: "var(--panel)",
                      border: "1px solid var(--rim)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                      zIndex: 20,
                      maxHeight: 320,
                      overflowY: "auto",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 12px",
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        letterSpacing: "0.15em",
                        color: "var(--text-dim)",
                        borderBottom: "1px solid var(--rim)",
                        textTransform: "uppercase",
                      }}
                    >
                      Version History · {versions.length}
                    </div>
                    {versions.map((v) => {
                      const active = v.id === currentId;
                      return (
                        <button
                          key={v.id}
                          onClick={() => {
                            setCurrentId(v.id);
                            setMenuOpen(false);
                          }}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            width: "100%",
                            padding: "8px 12px",
                            background: active ? "var(--surface)" : "transparent",
                            border: "none",
                            borderLeft: active
                              ? "2px solid var(--gold)"
                              : "2px solid transparent",
                            color: active ? "var(--gold)" : "var(--text)",
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                          onMouseEnter={(e) => {
                            if (!active) e.currentTarget.style.background = "var(--surface)";
                          }}
                          onMouseLeave={(e) => {
                            if (!active) e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <span>v{v.version ?? "—"}</span>
                          <span style={{ color: "var(--text-dim)", fontSize: 10 }}>
                            {v.report_date}
                            {v.is_latest && (
                              <span style={{ color: "var(--gold)", marginLeft: 8 }}>★</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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
