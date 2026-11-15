import { handler } from './index.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test({ name: 'UPDATE v1.4 scratch-row persistence, rollback and mode regressions (a-g)', ignore: Deno.env.get('TEST_TRACKER_LIVE') !== 'true', fn: async () => {
  const root = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret = Deno.env.get('INGEST_SECRET');
  if (!root || !key || !secret) throw new Error('Missing live test credentials');
  const client = createClient(root, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const prefix = `TEST|TRACKER_V14|${crypto.randomUUID()}`;
  const keys = [prefix + '|1', prefix + '|2'];
  const call = async (body: unknown) => {
    const req = new Request(`${root}/functions/v1/tracker-write`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const response = Deno.env.get('TEST_TRACKER_DEPLOYED') === 'true' ? await fetch(req) : await handler(req);
    return { code: response.status, body: await response.json() };
  };
  const read = async (dedupe = keys[0]) => {
    const { data, error } = await client.from('action_tracker').select('*').eq('dedupe_key', dedupe).single();
    if (error) throw new Error(error.message);
    return data;
  };
  const update = async (updates: unknown[]) => call({ mode: 'UPDATE', updates });
  try {
    const actions = keys.map(dedupe_key => ({ dedupe_key, ticker: 'TEST', action_type: 'MANUAL', summary: 'scratch original', context: 'original', due_date: '2026-11-15', priority: 'LOW' }));
    const inserted = await call({ mode: 'INSERT_IGNORE', actions });
    assertEquals(inserted.code, 200); assertEquals(inserted.body.affected, 2);
    const a = await update([{ dedupe_key: keys[0], status: 'OPEN', summary: 'new text', context: 'new context' }]);
    assertEquals(a.code, 200); assertEquals(a.body.version, 'v1.4');
    assertEquals([...a.body.rows[0].changed_fields].sort(), ['context', 'summary']);
    assertEquals(a.body.rows[0].mismatched_fields, []);
    assertEquals((await read()).summary, 'new text'); assertEquals((await read()).context, 'new context');
    console.log('a PASS: OPEN summary/context persisted, changed_fields=[summary,context], mismatches=[]');
    const b = await update([{ dedupe_key: keys[0], due_date: '2026-12-01', priority: 'HIGH' }]);
    assertEquals(b.code, 200); assertEquals((await read()).due_date, '2026-12-01'); assertEquals((await read()).priority, 'HIGH');
    console.log('b PASS: due_date=2026-12-01, priority=HIGH persisted without status');
    assertEquals((await update([{ dedupe_key: keys[0], status: 'CONFIRMED', resolution_note: 'scratch closure' }])).code, 200);
    assert((await read()).resolved_at);
    assertEquals((await update([{ dedupe_key: keys[0], status: 'OPEN' }])).code, 200);
    assertEquals((await read()).resolved_at, null); assertEquals((await read()).resolution_note, 'scratch closure');
    console.log('c PASS: close sets resolved_at; reopen clears timestamp and preserves absent fields');
    const before = await read();
    assertEquals((await update([{ dedupe_key: keys[0], ticker: 'BAD', summary: 'must not write' }])).code, 400);
    assertEquals(await read(), before);
    console.log('d PASS: unknown ticker rejected 400; row untouched');
    const before2 = await read(keys[1]);
    assertEquals((await update([{ dedupe_key: keys[0], summary: 'must rollback' }, { dedupe_key: keys[1], due_date: 'bad' }])).code, 400);
    assertEquals(await read(), before); assertEquals(await read(keys[1]), before2);
    console.log('e PASS: bad-date batch rejected 400; both rows untouched');
    // Row-dependent validation happens in the transaction, after the first write.
    assertEquals((await update([{ dedupe_key: keys[0], summary: 'must rollback in DB' }, { dedupe_key: keys[1], status: 'CONFIRMED' }])).code, 400);
    assertEquals(await read(), before); assertEquals(await read(keys[1]), before2);
    console.log('atomic PASS: missing close note rolls back earlier write in batch');
    const f = await update([{ dedupe_key: prefix + '|missing', summary: 'no match' }]);
    assertEquals(f.code, 207); assertEquals(f.body.status, 'PARTIAL'); assertEquals(f.body.affected, 0); assertEquals(f.body.mismatched, 0);
    console.log('f PASS: unmatched key => HTTP 207 PARTIAL, affected=0');
    const duplicate = await call({ mode: 'INSERT_IGNORE', actions });
    assertEquals(duplicate.code, 200); assertEquals(duplicate.body.affected, 0); assertEquals(duplicate.body.note, 'affected < requested means duplicates ignored (dedupe_key already exists)');
    const review = await call({ mode: 'REVIEW_UPDATE', updates: [{ id: crypto.randomUUID(), status: 'SCHEDULED' }] });
    assertEquals(review.code, 200); assertEquals(review.body, { status: 'success', mode: 'REVIEW_UPDATE', requested: 1, affected: 0, rows: [], note: 'affected < requested means no row matched' });
    console.log('g PASS: INSERT_IGNORE and REVIEW_UPDATE responses unchanged');
    // Explicit null date/context and identity precedence; verify read-back failures loudly.
    assertEquals((await update([{ dedupe_key: keys[0], due_date: null, context: null }])).code, 200);
    assertEquals((await read()).due_date, null); assertEquals((await read()).context, null);
    const row = await read();
    const identity = await update([{ id: row.id, dedupe_key: 'identity-not-a-target', source_ref: 'test/ref' }]);
    assertEquals(identity.code, 200); assertEquals((await read()).dedupe_key, keys[0]);
    const mismatch = await update([{ dedupe_key: keys[0], summary: 'first' }, { dedupe_key: keys[0], summary: 'second' }]);
    assertEquals(mismatch.code, 207); assertEquals(mismatch.body.affected, 1); assertEquals(mismatch.body.mismatched, 1); assertEquals(mismatch.body.rows[0].mismatched_fields, ['summary']);
    console.log('extra PASS: null clearing, immutable identity and final read-back mismatch detection');
  } finally {
    const { error } = await client.from('action_tracker').delete().in('dedupe_key', keys);
    if (error) throw new Error('Scratch cleanup failed');
    const { count, error: readError } = await client.from('action_tracker').select('id', { count: 'exact', head: true }).in('dedupe_key', keys);
    if (readError) throw new Error('Scratch cleanup verification failed');
    assertEquals(count, 0);
    console.log('cleanup PASS: both scratch rows deleted');
  }
} });