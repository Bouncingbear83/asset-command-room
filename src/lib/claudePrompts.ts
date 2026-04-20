export const CLAUDE_PROJECT_URL = "https://claude.ai/project/019ca3a9-aefe-77ea-af76-db62fd96f4e1";

export function buildDeepDivePrompt(ticker: string): string {
  const t = ticker.toUpperCase();
  const ilmnNote = t === "ILMN"
    ? "\n\nNote: ILMN is dual-held — the SIPP row needs manual sync (Research Commit tickerMatch is first-row only)."
    : "";
  return `Deep dive on ${t}.

Execute:

1. Load SCORES + HOLDINGS + WATCHLIST + DISRUPTION filtered to ${t}. For dual-held tickers (e.g. ILMN), pull both rows.

2. Pull prior score_rationales from Supabase if available for context

3. Web search last 30 days: material news, earnings, analyst revisions, competitive moves, regulatory developments

4. Reassess substrate test — has the thesis changed?

5. Reassess all 6 dimensions with sub-score rationales — note which dimensions moved and why

6. Reassess RECLASS_STATUS — any shift PRE → IN_PROGRESS → COMPLETE?

7. Reassess disruption score — amber/red trigger proximity

8. Reassess buy zone, ADD trigger, EXIT trigger

9. Check: does this position still fit layer target? Any factor concentration change?

10. Output: Research Commit payload (UPDATE_SCORE) with per-dimension rationales + disruption rationale — pause for confirmation${ilmnNote}`;
}

export function buildWatchlistReviewPrompt(ticker: string): string {
  const t = ticker.toUpperCase();
  return `Watchlist review for ${t}.

Execute:

1. Load WATCHLIST row + SCORES row + any HOLDINGS row for ${t}

2. Web search: current price, 30 days material news, entry-zone-relevant catalysts, analyst changes, any IPO/listing developments for pre-IPO entries

3. Assess four things:

   - Is ENTRY_TARGET still valid given current market conditions?

   - Is TRIGGER_CONDITION still the right catalyst to wait for?

   - Has the underlying substrate thesis aged or strengthened?

   - Has the candidate moved closer to, or further from, buy zone?

4. Decision tree:

   - If thesis unchanged + near entry zone: recommend ALERT_STATUS update + deploy action

   - If thesis materially changed: Research Commit (UPDATE_SCORE) with new ENTRY_TARGET, TRIGGER_CONDITION, THESIS, per-dimension rationales

   - If thesis broken or substrate test no longer passes: Research Commit with STATUS = REJECTED + reasoning

   - If still valid but far from zone: update TRIGGER_REVIEW_DATE + TRIGGER_REVIEW_NOTE only

5. Output: Research Commit payload (or no-change confirmation) — pause for confirmation`;
}

export function buildSubstrateAuditPrompt(ticker: string): string {
  const t = ticker.toUpperCase();
  return `Substrate audit for ${t} — from-scratch audit, not a stress-test of an existing thesis.

Execute:

1. Treat this ticker as a candidate with no prior commitments. Do not anchor on existing notes.

2. Web search: business model, end markets, revenue mix, competitive landscape, capital structure, recent 2 years of news + earnings.

3. Run the substrate test from first principles:

   - Is the underlying substrate (technology, resource, network, regulation) durable for the next 5–10 years?

   - What is the irreducible "why this exists" — the demand vector that does not depend on a specific product cycle?

   - What would have to be true for this thesis to be wrong?

4. Score all 6 dimensions (substrate, demand, moat, valuation, mgmt, disruption) from cold — provide rationales as if writing them for the first time.

5. Decide: COMMIT (move to scored watchlist with ENTRY_TARGET + TRIGGER_CONDITION), DEFER (more research needed — list specific questions), or REJECT (substrate fails — explain).

6. Output: Research Commit payload — pause for confirmation`;
}

