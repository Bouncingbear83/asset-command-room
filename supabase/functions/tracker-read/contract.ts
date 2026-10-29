import { object, text, optionalFields } from '../_shared/tracker-validation.ts';
export const ALLOWED = ['score_rationales','disruption_rationales','scores_snapshot','themes_history','action_tracker','scheduled_reviews','layer_review_schedule','narrative_watch','bottleneck_map','vault_notes_meta','watchlist_price_history','holdings_snapshot','layer_weights_snapshot','factor_group_weights','macro_snapshot','v_price_history_coverage','price_symbol_map'];
// Preserve the original PostgREST grammar; v2 replaces the obsolete layer_weights name.
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

export function buildRpcRead(input: unknown) {
  const body = object(input, 'body');
  if (Object.hasOwn(body, 'table')) throw new Error('table must be absent when rpc is present');
  const rpc = String(body.rpc);
  if (rpc !== 'vault_search' && rpc !== 'get_missing_watchlist_tickers' && rpc !== 'get_price_trajectories') throw new Error('RPC_NOT_ALLOWED: ' + rpc);
  const args = object(body.args, 'args');
  const result: Record<string, unknown> = {};
  if (rpc === 'vault_search') {
    result.search_query = text(args.search_query, 'search_query', 200);
    const max = args.max_results === undefined ? 20 : args.max_results;
    if (!Number.isInteger(max) || typeof max !== 'number' || max < 1 || max > 50) throw new Error('max_results must be an integer 1-50');
    result.max_results = max;
    optionalFields(args, result, { note_type: value => text(value, 'note_type', 40) }, false);
  } else if (rpc === 'get_price_trajectories') {
    if (!Array.isArray(args.p_tickers) || args.p_tickers.length < 1 || args.p_tickers.length > 500) throw new Error('p_tickers needs 1-500 strings');
    result.p_tickers = args.p_tickers.map(value => text(value, 'ticker', 20));
  } else {
    if (!Array.isArray(args.tickers) || args.tickers.length < 1 || args.tickers.length > 500) throw new Error('tickers needs 1-500 strings');
    result.tickers = args.tickers.map(value => text(value, 'ticker', 20));
  }
  return { rpc, args: result };
}
