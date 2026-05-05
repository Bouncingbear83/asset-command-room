## Narrative Signals card on Command tab

### 1. Database (migration)
Add anon-accessible policies on `narrative_signals` (existing service-role policy stays):
- `SELECT` policy for `anon` + `authenticated`: `USING (true)`
- `UPDATE` policy for `anon` + `authenticated`: `USING (true) WITH CHECK (true)` — column-level write access is enforced in app code (we only set `review_status`, `review_note`, `reviewed_at`, `reviewed_by`).
- Add table to `supabase_realtime` publication and set `REPLICA IDENTITY FULL` so realtime delivers full row payloads.

### 2. New hook — `src/hooks/useNarrativeSignals.ts`
- Initial fetch: `select id, ticker, name, layer, source_table, signal_class, strength, headline, url, snippet, matched_keywords, created_at, review_status` from `narrative_signals` where `review_status='NEW'` and `strength in ('HIGH','MEDIUM')`, ordered by `strength` (HIGH first via custom sort) then `created_at desc`, limit 50.
- Subscribe to `postgres_changes` on `public.narrative_signals` (`event: '*'`). On INSERT matching filter → prepend; on UPDATE → if no longer `NEW`, drop from list; on DELETE → remove.
- Expose `signals`, `loading`, `error`, and `markReviewed(id)` which calls `supabase.from('narrative_signals').update({ review_status: 'REVIEWED', reviewed_at: new Date().toISOString(), reviewed_by: 'command_ui' }).eq('id', id)`.

### 3. New component — `src/components/NarrativeSignalsCard.tsx`
Uses the same `card`/`cardHeader`/`cardTitle` style as other Command cards. Header: "Narrative Signals" + count chip + "LIVE" pulse dot.

Per-row layout (vertical stack inside a `var(--surface)` panel):
- Top row: ticker (gold `#C8A96E`, mono, larger), strength badge (HIGH = red, MEDIUM = amber, LOW = grey), `signal_class` pill, time-ago.
- Sub-row: `name` · layer tag · `source_table` tag (small uppercase mono).
- Headline (one-line, ellipsis), snippet collapsed behind a "Show snippet" toggle.
- Matched keywords as small mono caption (`KEYWORDS · …`).
- Footer: "Source ↗" link (uses `(window.top || window).open(url, '_blank')` per iframe-link rule) + two action buttons:
  - **Mark Reviewed** → `markReviewed(id)`, optimistic remove, toast on success/error.
  - **Open in Research Commit** → opens `https://bertbroad83.app.n8n.cloud/workflow/Qh4BzSYdf7jkZId5` in new tab (ticker noted in toast: "Opening Research Commit for {TICKER}"); n8n won't accept a param.

Empty state: "No new HIGH/MEDIUM signals" centred dim text.

### 4. Wire into `CommandTab.tsx`
Insert `<NarrativeSignalsCard />` in the existing grid (line ~620), placed directly under `<ReviewQueue />` and above the Latest Research block.

### 5. Memory updates
Add a memory file `mem://features/narrative-signals-card` describing the card, realtime subscription, and review action; add an index entry.

### Notes
- All styling reuses existing tokens (`--gold`, `--red`, `--amber`, `--text-dim`, `--surface`, `--rim`, `--font-mono`).
- No new dependencies.
- Anon UPDATE is acceptable here because the table is internal narrative-signal triage and the app is gated by `PasswordGate`; matches the access posture of other Supabase tables in the project.
