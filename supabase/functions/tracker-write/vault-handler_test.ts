import { handler } from './index.ts';

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Assertion failed');
}

async function runVault(size: number, returned: number, error = false) {
  const originalFetch = globalThis.fetch;
  const keys = ['INGEST_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const previous = keys.map(key => Deno.env.get(key));
  Deno.env.set(keys[0], 'test-secret');
  Deno.env.set(keys[1], 'https://vault-test.invalid');
  Deno.env.set(keys[2], 'test-service-key');
  let calls = 0;
  const rows = Array.from({ length: size }, (_, index) => ({ path: `existing/${index}.md`, type: 'spec', identifier: String(index), body: 'unchanged' }));
  globalThis.fetch = async (input, options) => {
    calls++;
    const url = new URL(String(input));
    equal(url.pathname, '/rest/v1/vault_notes_meta');
    equal(url.searchParams.get('on_conflict'), 'path');
    equal(url.searchParams.get('select'), 'path,type,identifier');
    equal(options?.method, 'POST');
    equal(JSON.parse(String(options?.body)).length, size);
    const prefer = new Headers(options?.headers).get('Prefer') ?? '';
    if (prefer.includes('count=')) throw new Error('No count header allowed');
    if (!prefer.includes('resolution=merge-duplicates')) throw new Error('Must bulk upsert');
    return new Response(JSON.stringify(error ? { code: '57014', message: 'canceling statement due to statement timeout' } : rows.slice(0, returned).map(({ path, type, identifier }) => ({ path, type, identifier }))), { status: error ? 500 : 201, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const response = await handler(new Request('https://vault-test.invalid/functions/v1/tracker-write', { method: 'POST', headers: { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'VAULT_META_UPSERT', rows }) }));
    equal(calls, 1);
    return { status: response.status, body: await response.json() };
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => { const value = previous[index]; if (value === undefined) Deno.env.delete(key); else Deno.env.set(key, value); });
  }
}

for (const size of [50, 100]) {
  Deno.test(`vault ${size} rows use one bulk upsert and minimal success response`, async () => {
    const { status, body } = await runVault(size, size);
    equal(status, 200);
    equal(body.status, 'success');
    equal(body.mode, 'VAULT_META_UPSERT');
    equal(body.requested, size);
    equal(body.affected, size);
    equal(Object.keys(body.rows[0]), ['path', 'type', 'identifier']);
  });
}
Deno.test('vault statement timeout remains a loud 502 with PostgREST error', async () => {
  const { status, body } = await runVault(50, 0, true);
  equal(status, 502);
  equal(body.status, 'error');
  equal(body.postgrest.code, '57014');
});
Deno.test('vault incomplete returned count never reports success', async () => {
  const { status, body } = await runVault(50, 49);
  equal(status, 502);
  equal(body.status, 'error');
  equal(body.postgrest.code, 'VAULT_AFFECTED_MISMATCH');
});