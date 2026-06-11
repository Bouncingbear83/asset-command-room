import { useEffect, useMemo, useState } from "react";
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

type NoteType = "all" | "ticker" | "session" | "rule" | "framework" | "section" | "layer" | "trend" | "spec";
type SortField = "identifier" | "type" | "title" | "last_indexed";

const NOTE_TYPES: NoteType[] = ["all", "ticker", "session", "rule", "framework", "section", "layer", "trend", "spec"];

const GITHUB_RAW_BASE = "https://github.com/Bouncingbear83/stellar-ops/blob/main";

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

function displayId(note: NoteMeta): string {
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
  // Incoming: other notes that link TO this note
  const incoming = useMemo(() => {
    const id = note.identifier ?? "";
    const type = note.type;
    return backlinks.filter((b) => b.target_id === id && b.target_type === type);
  }, [note, backlinks]);

  // Outgoing: links FROM this note to other notes
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
                <button
                  style={linkBtn}
                  onClick={() => onNavigate(b.source_path)}
                >
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

/* ── VaultTab ── */
export default function VaultTab() {
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<NoteType>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("identifier");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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
    if (search.trim()) {
      const q = search.trim().toLowerCase();
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
  }, [notes, typeFilter, search, sortField, sortDir]);

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
      setSearch("");
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
          ...mono9,
          color: active ? "var(--text-mid)" : "var(--text-dim)",
          textAlign: "left", width: "100%",
        }}
      >
        {label}{arrow}
      </button>
    );
  };

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

      {/* Stats row */}
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

      {/* Dangling links warning */}
      {danglingLinks.length > 0 && (
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
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  background: "var(--deep)", border: "1px solid var(--rim)",
                  color: "var(--text)", padding: "6px 12px", width: 200,
                  outline: "none",
                }}
              />
            </div>
            <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
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

      <style>{`
        @media (max-width: 900px) {
          /* Stack detail panel below on narrow screens */
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
