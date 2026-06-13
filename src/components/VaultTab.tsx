import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ── types ── */
interface NoteMeta {
  path: string;
  type: string;
  identifier: string | null;
  title: string | null;
  frontmatter: Record<string, any> | null;
  last_indexed: string;
}

interface Backlink {
  id: number;
  source_path: string;
  source_type: string;
  target_type: string;
  target_id: string;
}

interface VaultSearchResult {
  path: string;
  type: string;
  identifier: string;
  title: string;
  sections: string[];
  frontmatter: Record<string, string>;
  rank: number;
  snippet: string | null;
}

interface VaultSearchResponse {
  query: string;
  type_filter: string | null;
  count: number;
  total: number;
  results: VaultSearchResult[];
}

type NoteType = "all" | "ticker" | "session" | "rule" | "framework" | "section" | "layer" | "trend" | "spec";
type SortField = "identifier" | "type" | "title" | "last_indexed";
type ViewMode = "browse" | "search";

const NOTE_TYPES: NoteType[] = ["all", "ticker", "session", "rule", "framework", "section", "layer", "trend", "spec"];
const VAULT_SEARCH_URL = "https://bertbroad83.app.n8n.cloud/webhook/stellar-vault-search";
const GITHUB_RAW_BASE = "https://github.com/Bouncingbear83/stellar-ops/blob/main";
const DEEP_DIVE_BASE = "https://claude.ai/project/019ca3a9-aefe-77ea-af76-db62fd96f4e1?q=Deep+dive+";

/* ── shared styles ── */
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
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em",
  textTransform: "uppercase",
};
const thStyle: React.CSSProperties = {
  ...mono9, color: "var(--text-dim)", padding: "8px 16px",
  borderBottom: "1px solid var(--rim)", textAlign: "left", fontWeight: 400, whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, padding: "10px 16px",
  borderBottom: "1px solid rgba(28,28,48,0.4)", verticalAlign: "top",
};
const pillBase: React.CSSProperties = {
  ...mono9, padding: "3px 10px", borderRadius: 2, display: "inline-block",
};
const inputStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11,
  background: "var(--deep)", border: "1px solid var(--rim)",
  color: "var(--text)", padding: "8px 14px",
  outline: "none", transition: "border-color 0.15s",
};

/* ── helpers ── */
function typeColor(type: string): React.CSSProperties {
  const map: Record<string, { bg: string; fg: string; border: string }> = {
    ticker: { bg: "var(--green-dim)", fg: "var(--green)", border: "color-mix(in srgb, var(--green) 35%, transparent)" },
    session: { bg: "var(--accent-dim)", fg: "var(--accent)", border: "color-mix(in srgb, var(--accent) 35%, transparent)" },
    rule: { bg: "var(--amber-dim)", fg: "var(--amber)", border: "color-mix(in srgb, var(--amber) 35%, transparent)" },
    framework: { bg: "var(--amber-dim)", fg: "var(--amber)", border: "color-mix(in srgb, var(--amber) 35%, transparent)" },
    section: { bg: "rgba(28,28,48,0.5)", fg: "var(--text-dim)", border: "var(--rim)" },
    layer: { bg: "var(--green-dim)", fg: "var(--green)", border: "color-mix(in srgb, var(--green) 35%, transparent)" },
    trend: { bg: "var(--red-dim)", fg: "var(--red)", border: "color-mix(in srgb, var(--red) 35%, transparent)" },
    spec: { bg: "var(--accent-dim)", fg: "var(--accent)", border: "color-mix(in srgb, var(--accent) 35%, transparent)" },
  };
  const c = map[type] ?? { bg: "rgba(28,28,48,0.5)", fg: "var(--text-dim)", border: "var(--rim)" };
  return { background: c.bg, color: c.fg, border: `1px solid ${c.border}` };
}

function displayId(note: NoteMeta | VaultSearchResult): string {
  if (note.identifier) return note.identifier;
  if (note.title) return note.title;
  return note.path.split("/").pop()?.replace(".md", "") ?? note.path;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function githubUrl(path: string): string {
  return `${GITHUB_RAW_BASE}/${path}`;
}

/* ── BacklinksPanel ── */
function BacklinksPanel({
  note, backlinks, notes, onNavigate,
}: {
  note: NoteMeta;
  backlinks: Backlink[];
  notes: NoteMeta[];
  onNavigate: (path: string) => void;
}) {
  const incoming = useMemo(() => {
    const id = note.identifier ?? "";
    const type = note.type;
    return backlinks.filter((b) => b.target_id === id && b.target_type === type);
  }, [note, backlinks]);

  const outgoing = useMemo(() => {
    return backlinks.filter((b) => b.source_path === note.path);
  }, [note, backlinks]);

  const noteMap = useMemo(() => {
    const m = new Map<string, NoteMeta>();
    for (const n of notes) m.set(n.path, n);
    return m;
  }, [notes]);

  function resolveTargetPath(b: Backlink): string | null {
    for (const n of notes) {
      if (n.type === b.target_type && n.identifier === b.target_id) return n.path;
    }
    return null;
  }

  const linkBtn: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer", padding: 0,
    fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)",
    textDecoration: "none", textAlign: "left",
  };

  const sectionTitle: React.CSSProperties = {
    ...mono9, color: "var(--text-dim)", marginBottom: 8, marginTop: 16,
  };

  const fm = note.frontmatter ?? {};

  return (
    <div style={{ padding: "16px 20px" }}>
      {/* Frontmatter summary */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ ...pillBase, ...typeColor(note.type) }}>{note.type}</span>
        {fm.score && <span style={{ ...mono9, color: "var(--gold)" }}>SCORE {fm.score}</span>}
        {fm.tier && <span style={{ ...mono9, color: "var(--text-mid)" }}>{fm.tier}</span>}
        {fm.status && <span style={{ ...mono9, color: "var(--text-dim)" }}>{fm.status}</span>}
        {fm.layer && <span style={{ ...mono9, color: "var(--text-dim)" }}>{fm.layer}</span>}
        {fm.substrate_level && <span style={{ ...mono9, color: "var(--text-dim)" }}>{fm.substrate_level}</span>}
        {fm.stellar_type && <span style={{ ...mono9, color: "var(--text-dim)" }}>TYPE {fm.stellar_type}</span>}
      </div>

      {/* GitHub link */}
      <a
        href={githubUrl(note.path)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...mono9, color: "var(--accent)", textDecoration: "none", display: "inline-block", marginBottom: 12 }}
      >
        ↗ VIEW ON GITHUB
      </a>

      {/* Deep Dive link for tickers */}
      {note.type === "ticker" && note.identifier && (
        <a
          href={`${DEEP_DIVE_BASE}${note.identifier}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...mono9, color: "var(--gold)", textDecoration: "none", display: "inline-block", marginBottom: 12, marginLeft: 16 }}
        >
          ◈ DEEP DIVE
        </a>
      )}

      {/* Incoming backlinks */}
      <div style={sectionTitle}>
        REFERENCED BY ({incoming.length})
      </div>
      {incoming.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", padding: "4px 0" }}>No incoming links.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {incoming.map((b) => {
            const src = noteMap.get(b.source_path);
            return (
              <div key={b.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ ...pillBase, ...typeColor(b.source_type), fontSize: 8, padding: "2px 6px" }}>{b.source_type}</span>
                <button style={linkBtn} onClick={() => onNavigate(b.source_path)}>
                  {src ? displayId(src) : b.source_path.split("/").pop()?.replace(".md", "")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Outgoing links */}
      <div style={sectionTitle}>
        LINKS TO ({outgoing.length})
      </div>
      {outgoing.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", padding: "4px 0" }}>No outgoing links.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {outgoing.map((b) => {
            const targetPath = resolveTargetPath(b);
            return (
              <div key={b.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ ...pillBase, ...typeColor(b.target_type), fontSize: 8, padding: "2px 6px" }}>{b.target_type}</span>
                {targetPath ? (
                  <button style={linkBtn} onClick={() => onNavigate(targetPath)}>
                    {b.target_id}
                  </button>
                ) : (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)" }}>
                    {b.target_id} ⚠ DANGLING
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── SearchResultCard ── */
function SearchResultCard({ result }: { result: VaultSearchResult }) {
  const [expanded, setExpanded] = useState(false);
  const fm = result.frontmatter ?? {};
  const deepDiveUrl = result.type === "ticker" ? `${DEEP_DIVE_BASE}${result.identifier}` : null;

  return (
    <div
      style={{
        ...card,
        marginBottom: 0,
        padding: "14px 20px",
        transition: "border-color 0.15s",
        cursor: "default",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--text-dim)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--rim)"; }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Type pill */}
        <span style={{ ...pillBase, ...typeColor(result.type), marginTop: 2, flexShrink: 0 }}>
          {result.type}
        </span>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--gold)", fontWeight: 600 }}>
              {result.title || result.identifier || result.path.split("/").pop()?.replace(".md", "")}
            </span>
            {fm.score && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)" }}>
                {fm.score}
              </span>
            )}
            {fm.tier && (
              <span style={{ ...mono9, color: "var(--text-dim)" }}>{fm.tier}</span>
            )}
          </div>

          {/* Path */}
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 3, opacity: 0.7 }}>
            {result.path}
          </div>

          {/* Snippet */}
          {result.snippet && (
            <div
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)",
                marginTop: 8, lineHeight: 1.6, maxHeight: 48, overflow: "hidden",
              }}
              dangerouslySetInnerHTML={{
                __html: result.snippet
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(
                    /\*\*([^*]+)\*\*/g,
                    '<span style="background:rgba(200,169,110,0.15);color:var(--gold);padding:0 3px;border-radius:2px">$1</span>'
                  ),
              }}
            />
          )}

          {/* Frontmatter chips */}
          {result.type === "ticker" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {fm.layer && (
                <span style={{ ...mono9, fontSize: 8, padding: "2px 8px", background: "rgba(28,28,48,0.6)", color: "var(--text-dim)", borderRadius: 2 }}>
                  {fm.layer}
                </span>
              )}
              {fm.substrate_level && (
                <span style={{ ...mono9, fontSize: 8, padding: "2px 8px", background: "rgba(28,28,48,0.6)", color: "var(--text-dim)", borderRadius: 2 }}>
                  {fm.substrate_level}
                </span>
              )}
              {fm.return_profile && (
                <span style={{ ...mono9, fontSize: 8, padding: "2px 8px", background: "rgba(28,28,48,0.6)", color: "var(--text-dim)", borderRadius: 2 }}>
                  {fm.return_profile}
                </span>
              )}
              {fm.status && (
                <span style={{ ...mono9, fontSize: 8, padding: "2px 8px", background: "rgba(28,28,48,0.6)", color: "var(--text-dim)", borderRadius: 2 }}>
                  {fm.status}
                </span>
              )}
            </div>
          )}

          {/* Sections toggle */}
          {result.sections.length > 0 && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  ...mono9, fontSize: 8, color: "var(--text-dim)", marginTop: 8,
                }}
              >
                {expanded ? "Hide" : "Show"} {result.sections.length} sections
              </button>
              {expanded && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {result.sections.map((s) => (
                    <span
                      key={s}
                      style={{
                        ...mono9, fontSize: 8, padding: "2px 8px",
                        background: "rgba(28,28,48,0.4)", color: "var(--text-dim)",
                        borderRadius: 2, border: "1px solid var(--rim)",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <a
            href={githubUrl(result.path)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...mono9, fontSize: 8, padding: "4px 10px",
              background: "rgba(28,28,48,0.6)", color: "var(--text-dim)",
              textDecoration: "none", borderRadius: 2, border: "1px solid var(--rim)",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-dim)"; }}
          >
            ↗ GITHUB
          </a>
          {deepDiveUrl && (
            <a
              href={deepDiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...mono9, fontSize: 8, padding: "4px 10px",
                background: "rgba(200,169,110,0.06)", color: "var(--gold)",
                textDecoration: "none", borderRadius: 2, border: "1px solid color-mix(in srgb, var(--gold) 25%, transparent)",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(200,169,110,0.12)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(200,169,110,0.06)"; }}
            >
              ◈ DEEP DIVE
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── VaultTab ── */
export default function VaultTab() {
  /* Browse state (Supabase) */
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<NoteType>("all");
  const [browseFilter, setBrowseFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("identifier");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  /* Search state (webhook) */
  const [viewMode, setViewMode] = useState<ViewMode>("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTypeFilter, setSearchTypeFilter] = useState("");
  const [searchResults, setSearchResults] = useState<VaultSearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* Load Supabase data */
  useEffect(() => {
    (async () => {
      try {
        const [notesRes, linksRes] = await Promise.all([
          (supabase as any).from("vault_notes_meta").select("*").order("type").order("identifier"),
          (supabase as any).from("vault_backlinks").select("*"),
        ]);
        if (notesRes.error) throw notesRes.error;
        if (linksRes.error) throw linksRes.error;
        setNotes(notesRes.data ?? []);
        setBacklinks(linksRes.data ?? []);
      } catch (e: any) {
        setError(e.message ?? "Failed to load vault data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* Debounced webhook search */
  const fireSearch = useCallback(async (query: string, type?: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(VAULT_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), type: type || undefined, limit: 30 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: VaultSearchResponse = await res.json();
      setSearchResults(data);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode !== "search") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fireSearch(searchQuery, searchTypeFilter || undefined);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, searchTypeFilter, viewMode, fireSearch]);

  /* Browse computed */
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of notes) m[n.type] = (m[n.type] ?? 0) + 1;
    return m;
  }, [notes]);

  const danglingLinks = useMemo(() => {
    const knownIds = new Set(notes.map((n) => `${n.type}::${n.identifier}`));
    return backlinks.filter((b) => !knownIds.has(`${b.target_type}::${b.target_id}`));
  }, [notes, backlinks]);

  const filtered = useMemo(() => {
    let rows = notes;
    if (typeFilter !== "all") rows = rows.filter((n) => n.type === typeFilter);
    if (browseFilter.trim()) {
      const q = browseFilter.trim().toLowerCase();
      rows = rows.filter(
        (n) =>
          (n.identifier ?? "").toLowerCase().includes(q) ||
          (n.title ?? "").toLowerCase().includes(q) ||
          n.path.toLowerCase().includes(q),
      );
    }
    const dirMul = sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av = sortVal(a, sortField);
      const bv = sortVal(b, sortField);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av.localeCompare(bv) * dirMul;
    });
    return rows;
  }, [notes, typeFilter, browseFilter, sortField, sortDir]);

  const selectedNote = useMemo(() => notes.find((n) => n.path === selected) ?? null, [notes, selected]);

  function toggleSort(field: SortField) {
    if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  function handleNavigate(path: string) {
    const note = notes.find((n) => n.path === path);
    if (note) {
      setSelected(path);
      setTypeFilter("all");
      setBrowseFilter("");
      setViewMode("browse");
    }
  }

  const lastIndexed = notes.length > 0
    ? notes.reduce((latest, n) => (n.last_indexed > latest ? n.last_indexed : latest), notes[0].last_indexed)
    : null;

  const sortBtn = (field: SortField, label: string) => {
    const active = sortField === field;
    const arrow = active ? (sortDir === "asc" ? " ▲" : " ▼") : "";
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        style={{
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          ...mono9, color: active ? "var(--text-mid)" : "var(--text-dim)",
          textAlign: "left", width: "100%",
        }}
      >
        {label}{arrow}
      </button>
    );
  };

  /* ── Render ── */
  return (
    <div style={{ padding: "24px var(--app-px, 40px)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--gold)", margin: 0 }}>
          Vault
        </h2>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {lastIndexed && (
            <span style={{ ...mono9, color: "var(--text-dim)" }}>
              INDEXED {formatDate(lastIndexed)}
            </span>
          )}
          <span style={{ ...mono9, color: "var(--text-dim)" }}>
            {notes.length} NOTES · {backlinks.length} LINKS
          </span>
        </div>
      </div>

      {/* Search bar + mode toggle */}
      <div style={{ ...card, padding: "16px 20px", display: "flex", gap: 12, alignItems: "center" }}>
        {/* Mode toggle */}
        <div style={{ display: "flex", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
          {(["browse", "search"] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setViewMode(m); if (m === "search") setTimeout(() => searchInputRef.current?.focus(), 50); }}
              style={{
                ...mono9,
                padding: "6px 14px",
                border: "1px solid var(--rim)",
                borderRight: m === "browse" ? "none" : undefined,
                background: viewMode === m ? "rgba(200,169,110,0.08)" : "transparent",
                color: viewMode === m ? "var(--gold)" : "var(--text-dim)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {m === "browse" ? "BROWSE" : "SEARCH"}
            </button>
          ))}
        </div>

        {/* Search input */}
        {viewMode === "search" ? (
          <>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: 14, pointerEvents: "none" }}>⌕</span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Full-text search across all vault notes..."
                style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rim)"; }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSearchResults(null); }}
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer",
                    fontFamily: "var(--font-mono)", fontSize: 14,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={searchTypeFilter}
              onChange={(e) => setSearchTypeFilter(e.target.value)}
              style={{
                ...inputStyle, padding: "8px 12px", cursor: "pointer", flexShrink: 0,
                appearance: "none", paddingRight: 24,
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23666'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
              }}
            >
              <option value="">All types</option>
              {NOTE_TYPES.filter((t) => t !== "all").map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </>
        ) : (
          <input
            type="text"
            placeholder="Filter notes..."
            value={browseFilter}
            onChange={(e) => { setBrowseFilter(e.target.value); setSelected(null); }}
            style={{ ...inputStyle, flex: 1 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rim)"; }}
          />
        )}
      </div>

      {/* Stats row (browse mode only) */}
      {viewMode === "browse" && (
        <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 0 }}>
          {NOTE_TYPES.filter((t) => t !== "all").map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t === typeFilter ? "all" : t); setSelected(null); }}
              style={{
                flex: "1 1 auto", minWidth: 90, padding: "14px 16px",
                background: typeFilter === t ? "rgba(200,169,110,0.06)" : "transparent",
                border: "none", borderRight: "1px solid var(--rim)",
                cursor: "pointer", textAlign: "center",
              }}
            >
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: typeFilter === t ? "var(--gold)" : "var(--text-mid)", fontWeight: 700 }}>
                {typeCounts[t] ?? 0}
              </div>
              <div style={{ ...mono9, color: typeFilter === t ? "var(--gold)" : "var(--text-dim)", marginTop: 4 }}>
                {t}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Dangling links warning */}
      {danglingLinks.length > 0 && viewMode === "browse" && (
        <div style={{
          ...card, padding: "12px 20px",
          borderColor: "color-mix(in srgb, var(--amber) 40%, transparent)",
          background: "var(--amber-dim)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ ...mono9, color: "var(--amber)" }}>
            ⚠ {danglingLinks.length} DANGLING LINK{danglingLinks.length > 1 ? "S" : ""}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
            {[...new Set(danglingLinks.map((b) => `${b.target_type}:${b.target_id}`))].slice(0, 5).join(", ")}
            {danglingLinks.length > 5 ? ` +${danglingLinks.length - 5} more` : ""}
          </span>
        </div>
      )}

      {/* ── SEARCH RESULTS VIEW ── */}
      {viewMode === "search" && (
        <div>
          {/* Status */}
          {searchLoading && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", padding: "12px 0", opacity: 0.7 }}>
              Searching...
            </div>
          )}
          {searchError && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)", padding: "12px 0" }}>
              {searchError}
            </div>
          )}
          {searchResults && !searchLoading && (
            <div style={{ ...mono9, color: "var(--text-dim)", padding: "8px 0 12px", display: "flex", justifyContent: "space-between" }}>
              <span>{searchResults.count} of {searchResults.total} results{searchResults.type_filter ? ` · ${searchResults.type_filter}` : ""}</span>
              <span>QUERY: "{searchResults.query}"</span>
            </div>
          )}
          {/* Result cards */}
          {searchResults?.results && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {searchResults.results.map((r) => (
                <SearchResultCard key={r.path} result={r} />
              ))}
            </div>
          )}
          {/* Empty state */}
          {!searchQuery && !searchResults && !searchLoading && (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-dim)", marginBottom: 8 }}>
                Full-text search across all vault notes
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", opacity: 0.6 }}>
                Tickers, sessions, rules, frameworks, specs
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BROWSE TABLE VIEW ── */}
      {viewMode === "browse" && (
        <>
          {loading ? (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", padding: 20 }}>Loading vault...</div>
          ) : error ? (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)", padding: 20 }}>{error}</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 0 }}>
              {/* Notes table */}
              <div style={card}>
                <div style={cardHeader}>
                  <span style={cardTitle}>
                    {typeFilter === "all" ? "All Notes" : typeFilter.toUpperCase()}
                    <span style={{ fontWeight: 400, color: "var(--text-dim)", marginLeft: 8 }}>{filtered.length}</span>
                  </span>
                </div>
                <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 420px)", overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--panel)", zIndex: 1 }}>
                      <tr>
                        <th style={thStyle}>{sortBtn("type", "Type")}</th>
                        <th style={thStyle}>{sortBtn("identifier", "Identifier")}</th>
                        <th style={{ ...thStyle, display: selected ? "none" : undefined }}>{sortBtn("title", "Title")}</th>
                        <th style={thStyle}>Links</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((n) => {
                        const inCount = backlinks.filter((b) => b.target_id === n.identifier && b.target_type === n.type).length;
                        const outCount = backlinks.filter((b) => b.source_path === n.path).length;
                        const isActive = selected === n.path;
                        return (
                          <tr
                            key={n.path}
                            onClick={() => setSelected(isActive ? null : n.path)}
                            style={{
                              cursor: "pointer",
                              background: isActive ? "rgba(200,169,110,0.06)" : "transparent",
                              transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(28,28,48,0.6)"; }}
                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                          >
                            <td style={tdStyle}>
                              <span style={{ ...pillBase, ...typeColor(n.type) }}>{n.type}</span>
                            </td>
                            <td style={{ ...tdStyle, color: "var(--gold)", fontWeight: 600 }}>
                              {displayId(n)}
                            </td>
                            <td style={{ ...tdStyle, color: "var(--text-dim)", display: selected ? "none" : undefined }}>
                              {n.title ?? "—"}
                            </td>
                            <td style={tdStyle}>
                              <span style={{ ...mono9, color: inCount > 0 ? "var(--accent)" : "var(--text-dim)" }}>
                                {inCount}↓
                              </span>
                              <span style={{ ...mono9, color: "var(--text-dim)", margin: "0 4px" }}>/</span>
                              <span style={{ ...mono9, color: outCount > 0 ? "var(--green)" : "var(--text-dim)" }}>
                                {outCount}↑
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detail panel */}
              {selectedNote && (
                <div style={{ ...card, marginLeft: -1, borderLeft: "2px solid var(--gold)", alignSelf: "start", position: "sticky", top: 120, maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
                  <div style={cardHeader}>
                    <span style={{ ...cardTitle, color: "var(--gold)" }}>
                      {displayId(selectedNote)}
                    </span>
                    <button
                      onClick={() => setSelected(null)}
                      style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 14 }}
                    >
                      ✕
                    </button>
                  </div>
                  <BacklinksPanel
                    note={selectedNote}
                    backlinks={backlinks}
                    notes={notes}
                    onNavigate={handleNavigate}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      <style>{`
        @media (max-width: 900px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function sortVal(n: NoteMeta, field: SortField): string | null {
  switch (field) {
    case "type": return n.type;
    case "identifier": return (n.identifier ?? "").toLowerCase();
    case "title": return (n.title ?? "").toLowerCase();
    case "last_indexed": return n.last_indexed;
  }
}
