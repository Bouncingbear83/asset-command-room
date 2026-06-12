/**
 * Vault integration cards.
 * Holdings inline view: ticker EVOLUTION via score_rationales (every score commit).
 */
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  useVaultNote, useVaultNotes, useVaultBacklinks, useVaultNotesByPaths, VaultNote,
} from "@/hooks/useVaultContent";
import { VaultLayerPanel } from "@/components/vault/VaultContent";

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
const cardHeader: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 20px", borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
  letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-mid)",
};
const mono9: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
};
const bodyText: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.55,
  color: "var(--text-mid)", whiteSpace: "pre-wrap", wordBreak: "break-word",
};

function tidyMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[\[(ticker|rule|framework|section|session|layer|trend|spec):([^\]]+)\]\]/g, "$2")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatSessionDate(id: string | null): string {
  if (!id) return "";
  const m = id.match(/^(\d{4})-(\d{2})-(\d{2})-(\d+)$/);
  if (!m) return id;
  const [, y, mm, dd, n] = m;
  const monthName = new Date(`${y}-${mm}-${dd}`).toLocaleDateString("en-GB", { month: "short" });
  return `${dd} ${monthName} ${y} #${n}`;
}

function scoreColor(score: number | null): string {
  if (score == null) return "var(--text-dim)";
  if (score >= 80) return "var(--green)";
  if (score >= 60) return "var(--accent)";
  if (score >= 40) return "var(--amber)";
  return "var(--red)";
}

interface ScoreHistoryEntry {
  scored_at: string;
  total_score: number | null;
  tier: string | null;
  action: string | null;
  change_note: string | null;
  thesis_summary: string | null;
  scored_by: string | null;
}

function useScoreHistory(ticker: string | null) {
  const [entries, setEntries] = useState<ScoreHistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(!!ticker);

  useEffect(() => {
    let cancelled = false;
    if (!ticker) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("score_rationales")
        .select("scored_at, total_score, tier, action, change_note, thesis_summary, scored_by")
        .ilike("ticker", ticker)
        .order("scored_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      setEntries((data ?? []) as ScoreHistoryEntry[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ticker]);

  return { entries, loading };
}

function ScoreHistoryRow({ entry, prevScore }: { entry: ScoreHistoryEntry; prevScore: number | null }) {
  const [open, setOpen] = useState(false);
  const delta = entry.total_score != null && prevScore != null ? entry.total_score - prevScore : null;
  const hasDetail = !!(entry.change_note || entry.thesis_summary);

  return (
    <div style={{ borderTop: "1px solid rgba(28,28,48,0.4)" }}>
      <button
        onClick={() => hasDetail && setOpen((v) => !v)}
        disabled={!hasDetail}
        style={{
          background: "none", border: "none", width: "100%", textAlign: "left",
          cursor: hasDetail ? "pointer" : "default", padding: "8px 0",
          display: "flex", alignItems: "center", gap: 12, color: "inherit", flexWrap: "wrap",
        }}
      >
        <span style={{ ...mono9, color: "var(--text-dim)", width: 12 }}>
          {hasDetail ? (open ? "▾" : "▸") : " "}
        </span>
        <span style={{ ...mono9, color: "var(--gold)", width: 110 }}>{formatDate(entry.scored_at)}</span>
        <span style={{ ...mono9, color: scoreColor(entry.total_score), minWidth: 36 }}>
          {entry.total_score ?? "—"}
        </span>
        {delta !== null && delta !== 0 && (
          <span style={{ ...mono9, color: delta > 0 ? "var(--green)" : "var(--red)", fontSize: 9 }}>
            {delta > 0 ? "+" : ""}{delta}
          </span>
        )}
        {entry.tier && (<span style={{ ...mono9, color: "var(--text-mid)" }}>{entry.tier}</span>)}
        {entry.action && (
          <span style={{
            ...mono9, padding: "2px 6px", borderRadius: 2,
            color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
          }}>{entry.action}</span>
        )}
        {entry.change_note && !open && (
          <span style={{ ...bodyText, fontSize: 10, color: "var(--text-mid)", flex: 1, minWidth: 200,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {tidyMarkdown(entry.change_note)}
          </span>
        )}
      </button>
      {open && hasDetail && (
        <div style={{ paddingLeft: 24, paddingBottom: 12 }}>
          {entry.change_note && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ ...mono9, color: "var(--text-dim)", marginBottom: 4 }}>CHANGE NOTE</div>
              <div style={{ ...bodyText, fontSize: 10 }}>{tidyMarkdown(entry.change_note)}</div>
            </div>
          )}
          {entry.thesis_summary && (
            <div>
              <div style={{ ...mono9, color: "var(--text-dim)", marginBottom: 4 }}>THESIS AT TIME</div>
              <div style={{ ...bodyText, fontSize: 10 }}>{tidyMarkdown(entry.thesis_summary)}</div>
            </div>
          )}
          {entry.scored_by && (
            <div style={{ ...mono9, color: "var(--text-dim)", marginTop: 6, fontSize: 8 }}>
              by {entry.scored_by}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionEntry({ note }: { note: VaultNote }) {
  const [open, setOpen] = useState(false);
  const fm = note.frontmatter ?? {};
  const body = note.body ?? "";

  return (
    <div style={{ borderTop: "1px solid rgba(28,28,48,0.4)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none", border: "none", width: "100%", textAlign: "left",
          cursor: "pointer", padding: "8px 0", display: "flex", alignItems: "center",
          gap: 10, color: "inherit",
        }}
      >
        <span style={{ ...mono9, color: "var(--text-dim)" }}>{open ? "▾" : "▸"}</span>
        <span style={{ ...mono9, color: "var(--gold)" }}>{formatSessionDate(note.identifier)}</span>
        {fm.session_type && (
          <span style={{
            ...mono9, padding: "2px 8px", borderRadius: 2,
            color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
          }}>{fm.session_type}</span>
        )}
      </button>
      {open && (
        <div style={{ ...bodyText, padding: "0 0 12px 22px", fontSize: 10 }}>
          {body ? tidyMarkdown(body) : <span style={{ color: "var(--text-dim)" }}>No body content.</span>}
        </div>
      )}
    </div>
  );
}

export function VaultTickerThesis({ ticker }: { ticker: string | null }) {
  const { entries: scoreHistory, loading: shLoading } = useScoreHistory(ticker);
  const { backlinks, loading: blLoading } = useVaultBacklinks("ticker", ticker);

  const sessionPaths = useMemo(
    () => backlinks.filter((b) => b.source_type === "session").map((b) => b.source_path),
    [backlinks]
  );
  const { notes: sessionNotes } = useVaultNotesByPaths(sessionPaths);
  const sessionsSorted = useMemo(
    () => [...sessionNotes].sort((a, b) => (b.identifier ?? "").localeCompare(a.identifier ?? "")),
    [sessionNotes]
  );

  if (!ticker) return null;
  if (shLoading || blLoading) return null;
  if (scoreHistory.length === 0 && sessionsSorted.length === 0) return null;

  return (
    <div style={{ padding: "0 18px 14px" }}>
      <div style={{ borderTop: "1px solid var(--rim)", paddingTop: 12 }}>
        {scoreHistory.length > 0 && (
          <div style={{ marginBottom: sessionsSorted.length > 0 ? 16 : 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ ...mono9, color: "var(--gold)" }}>SCORE EVOLUTION</span>
              <span style={{ ...mono9, color: "var(--text-dim)" }}>{scoreHistory.length} ENTRIES</span>
            </div>
            <div>
              {scoreHistory.map((e, i) => {
                const prevScore = i + 1 < scoreHistory.length ? scoreHistory[i + 1].total_score : null;
                return <ScoreHistoryRow key={`${e.scored_at}-${i}`} entry={e} prevScore={prevScore} />;
              })}
            </div>
          </div>
        )}
        {sessionsSorted.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ ...mono9, color: "var(--gold)" }}>SESSION DISCUSSIONS</span>
              <span style={{ ...mono9, color: "var(--text-dim)" }}>{sessionsSorted.length}</span>
            </div>
            <div>{sessionsSorted.map((n) => <SessionEntry key={n.path} note={n} />)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function VaultWatchlistSnippet({ ticker }: { ticker: string | null }) {
  const { note, loading } = useVaultNote("ticker", ticker);
  if (!ticker || loading || !note) return null;
  const latestChange = note.body_sections?.["Latest change"];
  if (!latestChange) return null;
  return (
    <div style={{ borderTop: "1px solid var(--rim)", padding: "8px 0 4px" }}>
      <div style={{ ...mono9, fontSize: 8, color: "var(--gold)", marginBottom: 4 }}>VAULT LATEST CHANGE</div>
      <div style={{ ...bodyText, fontSize: 10 }}>{tidyMarkdown(latestChange)}</div>
    </div>
  );
}

function RecentSessionRow({ note }: { note: VaultNote }) {
  const [open, setOpen] = useState(false);
  const fm = note.frontmatter ?? {};
  const body = note.body ?? "";
  const tickersRaw = fm.tickers_touched ? String(fm.tickers_touched) : "";
  const tickers = tickersRaw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);

  return (
    <div style={{ borderLeft: "2px solid var(--rim)", paddingLeft: 12 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none", border: "none", padding: 0, cursor: "pointer",
          width: "100%", textAlign: "left", color: "inherit",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ ...mono9, color: "var(--text-dim)", fontSize: 11 }}>{open ? "▾" : "▸"}</span>
          <span style={{ ...mono9, color: "var(--gold)", fontSize: 11 }}>{formatSessionDate(note.identifier)}</span>
          {fm.session_type && (
            <span style={{
              ...mono9, padding: "2px 8px", borderRadius: 2,
              color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            }}>{fm.session_type}</span>
          )}
          {fm.fires && <span style={{ ...mono9, color: "var(--text-dim)" }}>{fm.fires} FIRES</span>}
        </div>
        {tickers.length > 0 && (
          <div style={{ ...mono9, color: "var(--text-dim)", marginBottom: 4, marginLeft: 22 }}>
            {tickers.join(" · ")}
          </div>
        )}
      </button>
      {open && (
        <div style={{
          ...bodyText, fontSize: 10,
          marginLeft: 22, marginTop: 6, padding: "10px 12px",
          background: "rgba(0,0,0,0.2)", border: "1px solid var(--rim)",
        }}>
          {body ? tidyMarkdown(body) : <span style={{ color: "var(--text-dim)" }}>No body content.</span>}
        </div>
      )}
    </div>
  );
}

export function VaultRecentSessions() {
  const { notes, loading } = useVaultNotes("session", 10);
  const [open, setOpen] = useState(true);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      style={card}
    >
      <summary style={{ ...cardHeader, cursor: "pointer", listStyle: "none", userSelect: "none" }}>
        <span style={{ ...cardTitle, display: "flex", alignItems: "center" }}>
          <span style={{ ...mono9, marginRight: 8 }}>{open ? "▾" : "▸"}</span>
          Recent Sessions
        </span>
        <span style={{ ...mono9, color: "var(--text-dim)" }}>
          {loading ? "..." : `${notes.length} IN VAULT`}
        </span>
      </summary>
      <div style={{ padding: "14px 20px" }}>
        {loading ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>Loading...</div>
        ) : notes.length === 0 ? (
          <div style={{ ...mono9, color: "var(--text-dim)" }}>No session notes in vault yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {notes.map((n) => <RecentSessionRow key={n.path} note={n} />)}
          </div>
        )}
      </div>
    </details>
  );
}

export function VaultLayerNote({ layer }: { layer: string | null }) {
  const { note, loading } = useVaultNote("layer", layer);
  if (!layer || loading || !note) return null;
  return (
    <details style={{ padding: "0 20px 14px" }}>
      <summary style={{
        cursor: "pointer", listStyle: "none", userSelect: "none",
        padding: "8px 0", display: "flex", alignItems: "center", gap: 8,
        borderTop: "1px solid var(--rim)",
      }}>
        <span style={{ ...mono9, color: "var(--text-dim)" }}>▸</span>
        <span style={{ ...mono9, color: "var(--gold)" }}>VAULT: LAYER NOTE</span>
      </summary>
      <VaultLayerPanel note={note} />
    </details>
  );
}
