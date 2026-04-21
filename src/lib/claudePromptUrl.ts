// Centralised Claude project deep-link builder.
// All Claude buttons across the dashboard funnel through this module so the
// prompt copy + URL shape stay consistent.
//
// NOTE: Uses the project ID specified in the approved plan. Open via
// `(window.top || window).open(url, '_blank')` to bypass iframe CSP.

const CLAUDE_PROJECT_BASE =
  "https://claude.ai/project/019ca3a9-aefe-77ea-af76-db62fd96f4e1";

export type PromptContext = Record<string, string | number | null | undefined>;

const TEMPLATES = {
  watchlist_deep_dive: (c: PromptContext) =>
    `Deep dive on ${c.ticker} (${c.name}) — ${c.layer} layer, currently ${c.status} with entry target ${c.entry_target}. Thesis: ${c.thesis}. Apply substrate test, 6D score, reclassification stage, entry sequencing.`,

  holdings_deep_dive: (c: PromptContext) =>
    `Thesis check on ${c.ticker}. MV £${c.mv}, ${c.aum_pct}% AUM, P&L ${c.gl_pct}%. ADD: ${c.add_trigger}. EXIT: ${c.exit_trigger}. Stress-test substrate thesis, reclassification stage, kill conditions. Verdict: hold / size up / size down / exit.`,

  intelligence_deep_dive: (c: PromptContext) =>
    `Deep dive on ${c.ticker} (${c.name}) — ${c.layer}, current score ${c.score}/100, tier ${c.tier}, status ${c.held_status}. Pull latest data, reassess all 6D, flag any score dimension requiring update.`,

  earnings_post: (c: PromptContext) =>
    `Post-earnings review of ${c.ticker} — ${c.fiscal_period} reported ${c.earnings_date}. Pull earnings, assess: (1) substrate thesis intact? (2) any 6D dimension changed? (3) exact SCORES / DISRUPTION / HOLDINGS sheet updates required. Produce Research Commit payload if scores change.`,

  substrate_audit: () =>
    `Substrate audit session. Waiting for ticker. Apply binary substrate test first. If pass: 6D score, disruption resilience, tier, buy/sell triggers, account recommendation, position size, kill condition. If fail: stop and explain why.`,

  layer_gaps: () =>
    `Layer gap analysis. Pull LAYERS + HOLDINGS + WATCHLIST + CASH via Sheet Reader. Rank gaps by priority vs targets. For each HIGH gap: cleanest substrate candidate, entry sequencing, deploy size, account. Flag any energy-overweight block on new adds.`,

  reclass_risk: () =>
    `Reclassification risk sweep. Pull SCORES via Sheet Reader. Identify: (1) held positions with RECLASS_STATUS = COMPLETE and valuation ≤8/13 — reclass premium captured, trim candidates; (2) watchlist names with RECLASS_STATUS = PRE and substrate ≥20/25 — pre-reclassification modifier eligible.`,

  log_trades: () =>
    `Trade log session. Paste trade(s) below. I will generate Trade Log webhook payload, confirm sheet row updates, flag CASH / concentration / layer impact and any Golden Rule conflict.`,

  dropdown_deep_dive: (c: PromptContext) =>
    `Deep dive on ${c.ticker}. Pull current state from HOLDINGS / SCORES / DISRUPTION via Sheet Reader. Full reassessment.`,

  watchlist_review: (c: PromptContext) =>
    `Watchlist review for ${c.ticker} (${c.name}) — ${c.layer}. Current: ${c.status}. Trigger condition: ${c.trigger_condition}. Entry target ${c.entry_target}. Pull latest news, reassess trigger validity, recommend: hold trigger / update trigger / upgrade to active / demote to research / reject.`,
} as const;

export type PromptTemplateKey = keyof typeof TEMPLATES;

export function buildClaudePromptUrl(
  templateKey: PromptTemplateKey,
  context: PromptContext = {},
): string {
  const tmpl = TEMPLATES[templateKey];
  const prompt = typeof tmpl === "function" ? tmpl(context) : String(tmpl);
  return `${CLAUDE_PROJECT_BASE}?q=${encodeURIComponent(prompt)}`;
}

export { CLAUDE_PROJECT_BASE };
