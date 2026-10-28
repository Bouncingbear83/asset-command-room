import { useState } from "react";
import { TickerLabel, NamedText } from "@/components/shared/TickerLabel";
import { supabase } from "@/integrations/supabase/client";
import { proxyWebhook } from "@/lib/ownerFunction";
import { openVaultNote } from "@/lib/navigate";
import type { Candidate } from "@/lib/actionSurface";
import {
  acceptPreview, adjacentBands, applyResultState, bandOf, buildAcceptRequest, DISMISS_BANDS, editBody,
  orderedLimbs, updateRowFor, validateEdit, type ApplyUiState,
} from "@/lib/earningsVerdict";
import { useEffect } from "react";

function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(4,4,10,0.7)" }} />
      <div style={{ position: "relative", width: "min(440px, 100vw)", height: "100%", background: "var(--panel)", borderLeft: "1px solid var(--rim)", overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--gold)" }}>{title}</div>
          <button aria-label="Close" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const mono = (size: number, color = "var(--text-mid)"): React.CSSProperties => ({ fontFamily: "var(--font-mono)", fontSize: size, color });
const BAND_COLOR: Record<string, string> = { KILL: "var(--red)", RED: "var(--red)", AMBER: "var(--amber)", CONFIRM: "var(--green)" };
const btn = (color: string): React.CSSProperties => ({ background: "transparent", border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`, color, ...mono(9, color), letterSpacing: "0.14em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 2, cursor: "pointer" });
const field: React.CSSProperties = { width: "100%", background: "var(--void, transparent)", border: "1px solid var(--rim)", color: "var(--text-mid)", fontFamily: "var(--font-mono)", fontSize: 11, padding: "6px 8px", borderRadius: 2 };

async function callApply(body: object) {
  const res = await proxyWebhook("apply-tracker", body);
  let json: any = null;
  try { json = await res.json(); } catch { json = { error: `HTTP ${res.status}` }; }
  if (!res.ok && !json?.error && !json?.stale) json = { ...json, error: `HTTP ${res.status}` };
  return json;
}

interface Props { c: Candidate; heldShares: number; onChanged: () => void }

export default function EarningsVerdictCard({ c, heldShares, onChanged }: Props) {
  const v = c.verdict!;
  const sp = v.payload;
  const [ui, setUi] = useState<ApplyUiState>({ stale: false, acceptDisabled: false, message: null });
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const staged = bandOf(sp);
  const firstUr = sp?.apply?.update_row?.updates?.[0];
  const [edit, setEdit] = useState({ band: staged, override_reason: "", aj_line: firstUr?.append?.trigger_review_note ?? "", review_date: firstUr?.fields?.trigger_review_date ?? "", limit: "", shares: "" });
  const [planned, setPlanned] = useState<any>(null);
  const [dismiss, setDismiss] = useState({ reason: "", band: staged === "NOT GRADED" ? "NO VERDICT" : staged });
  const color = BAND_COLOR[staged] ?? "var(--text-dim)";
  const ticket = sp?.apply?.trade_ticket;

  const run = async (body: object) => {
    setBusy(true);
    try {
      const r = await callApply(body);
      const s = applyResultState(r);
      setUi(s);
      if (!s.message && !r?.dry_run) onChanged();
      return r;
    } catch (e) { setUi({ stale: false, acceptDisabled: false, message: e instanceof Error ? e.message : String(e) }); return null; }
    finally { setBusy(false); }
  };

  const accept = () => run(buildAcceptRequest(v.id));
  const placed = () => { if (window.confirm("Order placed at broker?")) void run({ tracker_id: v.id, op: "placed" }); };

  const editFields = () => ({
    band: edit.band, override_reason: edit.override_reason, aj_line: edit.aj_line || undefined, review_date: edit.review_date || undefined,
    limit: edit.limit ? Number(edit.limit) : undefined, shares: edit.shares ? Math.min(Number(edit.shares), heldShares || Number(edit.shares)) : undefined,
  });
  const editError = validateEdit(staged, edit);
  const previewEdit = async () => { const r = await run(editBody(v.id, sp, editFields(), true)); setPlanned(r?.planned ?? null); };
  const submitEdit = async () => { const r = await run(editBody(v.id, sp, editFields())); if (r && !r.error && !r.stale) setEditOpen(false); };

  const submitDismiss = async () => {
    if (!dismiss.reason.trim()) return;
    setBusy(true);
    const decision = { action: "DISMISS", final_band: dismiss.band, override_reason: dismiss.reason.trim(), decided_at: new Date().toISOString(), exec_id: null, by: "APP" };
    const { error } = await (supabase as any).from("action_tracker").update({
      staged_payload: { ...sp, decision }, status: "DISMISSED", resolution_note: `DISMISS ${dismiss.band}; ${dismiss.reason.trim()}`.slice(0, 1000), resolved_at: new Date().toISOString(),
    }).eq("id", v.id).eq("status", "OPEN");
    setBusy(false);
    if (error) setUi({ stale: false, acceptDisabled: false, message: error.message }); else { setDismissOpen(false); onChanged(); }
  };

  const sources: string[] = (Array.isArray(sp?.grader?.searches) ? sp.grader.searches : []).map((s: any) => typeof s === "string" ? s : s?.url ?? JSON.stringify(s));
  const open = (u: string) => (window.top || window).open(u, "_blank");

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--rim)", borderLeft: `3px solid ${color}`, borderRadius: 2, padding: "10px 14px", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...mono(12, "var(--gold)"), fontWeight: 700 }}><TickerLabel ticker={c.ticker} plain /></span>
        <span style={mono(9, "var(--text-dim)")}>print {sp?.print_date ?? "—"}{sp?.fiscal_period ? ` · ${sp.fiscal_period}` : ""}</span>
        <span style={{ ...mono(8, color), letterSpacing: "0.12em", padding: "2px 8px", border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`, borderRadius: 2 }}>{staged}</span>
        {v.state === "ACCEPTED_TICKET" && <span style={mono(8, "var(--amber)")}>ACCEPTED · PLACE ORDER</span>}
      </div>

      <div style={{ display: "grid", gap: 2 }}>
        {orderedLimbs(sp).map((l) => (
          <div key={l.id} style={{ ...mono(10, l.failed ? "var(--red)" : "var(--text-mid)"), display: "flex", gap: 6, alignItems: "baseline" }}>
            <span style={{ ...mono(8, "var(--text-dim)"), border: "1px solid var(--rim)", padding: "0 4px" }}>{l.class ?? "?"}</span>
            <span>{l.id}{l.type ? ` · ${l.type}` : ""}: {l.result ?? "—"}{l.actual != null ? ` (${String(l.actual)})` : ""}</span>
            {l.atRisk && <span style={mono(8, "var(--amber)")}>AT RISK</span>}
          </div>
        ))}
      </div>

      {sp?.band_action && <div style={mono(11, "var(--text-mid)")}><NamedText text={sp.band_action} /></div>}
      <div style={mono(10, "var(--text-dim)")}>What Accept does: <span style={{ color: "var(--text-mid)" }}>{acceptPreview({ id: v.id, apply_target: v.apply_target, staged_payload: sp })}</span></div>

      <div style={{ display: "flex", gap: 12, ...mono(9, "var(--gold)") }}>
        {sp?.note_path && <button onClick={() => openVaultNote(sp.note_path)} style={{ ...mono(9, "var(--gold)"), background: "none", border: "none", cursor: "pointer", padding: 0 }}>Open note</button>}
        {sources.length > 0 && <button onClick={() => setShowSources((s) => !s)} style={{ ...mono(9, "var(--gold)"), background: "none", border: "none", cursor: "pointer", padding: 0 }}>Sources ({sources.length})</button>}
      </div>
      {showSources && <div style={{ display: "grid", gap: 2 }}>{sources.map((s, i) => /^https?:/.test(s)
        ? <button key={i} onClick={() => open(s)} style={{ ...mono(9, "var(--text-mid)"), background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0 }}>{s}</button>
        : <span key={i} style={mono(9)}>{s}</span>)}</div>}

      {ui.message && <div style={mono(10, ui.stale ? "var(--amber)" : "var(--red)")}>{ui.message}</div>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {v.state === "ACCEPTED_TICKET" ? (
          <button disabled={busy || ui.acceptDisabled} onClick={placed} style={btn("var(--green)")}>Placed</button>
        ) : (
          <>
            <button disabled={busy} onClick={() => setDismissOpen(true)} style={btn("var(--text-dim)")}>Dismiss</button>
            <button disabled={busy || ui.acceptDisabled} onClick={() => setEditOpen(true)} style={btn("var(--gold)")}>Edit</button>
            <button disabled={busy || ui.acceptDisabled} onClick={() => void accept()} style={{ ...btn("var(--green)"), opacity: ui.acceptDisabled ? 0.4 : 1 }}>Accept</button>
          </>
        )}
      </div>

      <Drawer open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${c.ticker} · ${staged}`}>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <label style={mono(9, "var(--text-dim)")}>Band (one step)</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[staged, ...adjacentBands(staged)].map((b) => (
                <button key={b} onClick={() => setEdit((e) => ({ ...e, band: b, aj_line: updateRowFor(sp, b)?.updates?.[0]?.append?.trigger_review_note ?? e.aj_line }))} style={{ ...btn(BAND_COLOR[b] ?? "var(--text-dim)"), background: edit.band === b ? "var(--rim)" : "transparent" }}>{b}</button>
              ))}
            </div>
            {edit.band !== staged && (<><label style={mono(9, "var(--text-dim)")}>Override reason (required)</label>
              <textarea value={edit.override_reason} onChange={(e) => setEdit({ ...edit, override_reason: e.target.value })} style={{ ...field, minHeight: 50 }} /></>)}
            <label style={mono(9, "var(--text-dim)")}>AJ line</label>
            <textarea value={edit.aj_line} onChange={(e) => setEdit({ ...edit, aj_line: e.target.value })} style={{ ...field, minHeight: 70 }} />
            <label style={mono(9, "var(--text-dim)")}>Review date</label>
            <input type="date" value={edit.review_date} onChange={(e) => setEdit({ ...edit, review_date: e.target.value })} style={field} />
            {ticket && (<>
              <label style={mono(9, "var(--text-dim)")}>Limit</label>
              <input type="number" value={edit.limit} onChange={(e) => setEdit({ ...edit, limit: e.target.value })} style={field} />
              <label style={mono(9, "var(--text-dim)")}>Shares (max {heldShares})</label>
              <input type="number" max={heldShares} value={edit.shares} onChange={(e) => setEdit({ ...edit, shares: e.target.value })} style={field} />
            </>)}
            {editError && <div style={mono(10, "var(--amber)")}>{editError}</div>}
            {ui.message && <div style={mono(10, ui.stale ? "var(--amber)" : "var(--red)")}>{ui.message}</div>}
            {planned && <pre style={{ ...mono(9), whiteSpace: "pre-wrap", border: "1px solid var(--rim)", padding: 8 }}>{JSON.stringify(planned, null, 2)}</pre>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button disabled={busy || !!editError || ui.acceptDisabled} onClick={() => void previewEdit()} style={btn("var(--gold)")}>Preview</button>
              <button disabled={busy || !!editError || ui.acceptDisabled} onClick={() => void submitEdit()} style={btn("var(--green)")}>Apply edit</button>
            </div>
          </div>
      </Drawer>

      <Drawer open={dismissOpen} onClose={() => setDismissOpen(false)} title={`Dismiss ${c.ticker}`}>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <label style={mono(9, "var(--text-dim)")}>Final band</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {DISMISS_BANDS.map((b) => <button key={b} onClick={() => setDismiss({ ...dismiss, band: b })} style={{ ...btn(BAND_COLOR[b] ?? "var(--text-dim)"), background: dismiss.band === b ? "var(--rim)" : "transparent" }}>{b}</button>)}
            </div>
            <label style={mono(9, "var(--text-dim)")}>Reason (required)</label>
            <textarea value={dismiss.reason} onChange={(e) => setDismiss({ ...dismiss, reason: e.target.value })} style={{ ...field, minHeight: 60 }} />
            <button disabled={busy || !dismiss.reason.trim()} onClick={() => void submitDismiss()} style={{ ...btn("var(--text-dim)"), justifySelf: "end" }}>Dismiss</button>
          </div>
      </Drawer>
    </div>
  );
}
