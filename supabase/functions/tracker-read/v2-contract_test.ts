import { buildReadRequest, buildRpcRead } from './contract.ts';
function equal(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function rejects(input: unknown, message?: string) { try { buildRpcRead(input); } catch (error) { if (message) equal((error as Error).message, message); return; } throw new Error('Expected rejection'); }
Deno.test('v2 replaces layer_weights without alias', () => {
  equal(buildReadRequest({ table: 'layer_weights_snapshot', query: 'order=snapshot_date.desc', limit: 10 }).url, '/rest/v1/layer_weights_snapshot?select=*&order=snapshot_date.desc&limit=10');
  try { buildReadRequest({ table: 'layer_weights' }); } catch (error) { equal((error as Error).message, 'TABLE_NOT_ALLOWED: layer_weights'); return; }
  throw new Error('Expected layer_weights rejection');
});
Deno.test('vault_search passes SQL argument names and defaults max_results to 20', () => equal(buildRpcRead({ rpc: 'vault_search', args: { search_query: 'Narrative Watch' } }), { rpc: 'vault_search', args: { search_query: 'Narrative Watch', max_results: 20 } }));
Deno.test('vault_search accepts max 50 and optional note_type', () => equal(buildRpcRead({ rpc: 'vault_search', args: { search_query: 'KLAC', max_results: 50, note_type: 'ticker' } }).args, { search_query: 'KLAC', max_results: 50, note_type: 'ticker' }));
Deno.test('vault_search caps query at 200 characters', () => { buildRpcRead({ rpc: 'vault_search', args: { search_query: 'x'.repeat(200) } }); rejects({ rpc: 'vault_search', args: { search_query: 'x'.repeat(201) } }); });
Deno.test('vault_search max_results must be integer 1-50', () => { for (const max_results of [0, 51, 1.5, '5', null]) rejects({ rpc: 'vault_search', args: { search_query: 'x', max_results } }); });
Deno.test('vault_search note_type must be string at most 40', () => { buildRpcRead({ rpc: 'vault_search', args: { search_query: 'x', note_type: 'x'.repeat(40) } }); for (const note_type of ['x'.repeat(41), null, 7]) rejects({ rpc: 'vault_search', args: { search_query: 'x', note_type } }); });
Deno.test('RPC mode rejects table presence even null', () => rejects({ rpc: 'vault_search', table: null, args: { search_query: 'x' } }, 'table must be absent when rpc is present'));
Deno.test('unknown RPC pg_sleep rejected exactly', () => rejects({ rpc: 'pg_sleep', args: {} }, 'RPC_NOT_ALLOWED: pg_sleep'));
Deno.test('missing tickers pass through unchanged', () => equal(buildRpcRead({ rpc: 'get_missing_watchlist_tickers', args: { tickers: ['KLAC', '4368.T', 'ZZZZ_NOT_REAL'], ignored: true } }).args, { tickers: ['KLAC', '4368.T', 'ZZZZ_NOT_REAL'] }));
Deno.test('missing tickers list limited to 1-500 entries of at most 20 chars', () => { buildRpcRead({ rpc: 'get_missing_watchlist_tickers', args: { tickers: Array(500).fill('x'.repeat(20)) } }); for (const tickers of [[], Array(501).fill('A'), ['x'.repeat(21)], [5], 'A']) rejects({ rpc: 'get_missing_watchlist_tickers', args: { tickers } }); });