export const ALLOWED = ['score_rationales','disruption_rationales','scores_snapshot','themes_history','action_tracker','scheduled_reviews','layer_review_schedule','narrative_watch','bottleneck_map','vault_notes_meta','watchlist_price_history','holdings_snapshot','layer_weights','factor_group_weights','macro_snapshot'];
// Preserve the original PostgREST query grammar and allowlist, including layer_weights.
export function buildReadRequest(b: any) {
  b = b || {};
  const table = String(b.table || '').trim();
  if (!ALLOWED.includes(table)) throw new Error('TABLE_NOT_ALLOWED: ' + table);
  const select = encodeURIComponent(String(b.select || '*'));
  const q = String(b.query || '').replace(/^[?&]/, '');
  if (/[\s;]/.test(q)) throw new Error('QUERY_REJECTED: whitespace or semicolon');
  const limit = Math.min(Math.max(parseInt(b.limit || 1000, 10) || 1000, 1), 5000);
  return {table, url: '/rest/v1/' + table + '?select=' + select + (q ? '&' + q : '') + '&limit=' + limit};
}
