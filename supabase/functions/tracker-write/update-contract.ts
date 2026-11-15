import { stagedFields } from './staged.ts';

export const UPDATE_VERSION = 'v1.4';
const fields = new Set(['id', 'dedupe_key', 'status', 'summary', 'context', 'due_date', 'priority', 'resolution_note', 'source_ref', 'apply_target', 'staged_payload']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identity selects a row; only explicitly supplied mutable fields enter its patch. */
export function buildUpdateRequests(input: any) {
  const updates = Array.isArray(input?.updates) ? input.updates : [];
  if (!updates.length || updates.length > 50) throw new Error('UPDATE needs 1-50 updates');
  return updates.map((u: any, i: number) => {
    const label = `update ${i}`;
    if (!u || typeof u !== 'object' || Array.isArray(u)) throw new Error(`${label}: update must be an object`);
    for (const key of Object.keys(u)) if (!fields.has(key)) throw new Error(`${label}: unknown key ${key}`);
    const id = typeof u.id === 'string' && uuid.test(u.id) ? u.id : undefined;
    const dedupe = typeof u.dedupe_key === 'string' && u.dedupe_key.length ? u.dedupe_key : undefined;
    if (u.id !== undefined && !id) throw new Error(`${label}: id (uuid) or dedupe_key required`);
    if (!id && !dedupe) throw new Error(`${label}: id (uuid) or dedupe_key required`);
    const body: Record<string, unknown> = {};
    for (const key of ['status', 'summary', 'context', 'due_date', 'priority', 'resolution_note', 'source_ref']) {
      if (!Object.hasOwn(u, key)) continue;
      const value = u[key];
      if (key === 'status' && !['OPEN', 'CONFIRMED', 'DISMISSED'].includes(value)) throw new Error(`${label}: status must be OPEN|CONFIRMED|DISMISSED`);
      if (key === 'priority' && !['HIGH', 'MEDIUM', 'LOW'].includes(value)) throw new Error(`${label}: priority must be HIGH|MEDIUM|LOW`);
      if (key === 'due_date' && value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error(`${label}: due_date yyyy-mm-dd required`);
      if (key === 'summary' && (typeof value !== 'string' || !value.trim() || value.length > 2000)) throw new Error(`${label}: summary must be nonempty and <=2000 chars`);
      if (['context', 'resolution_note'].includes(key) && value !== null && (typeof value !== 'string' || value.length > 4000)) throw new Error(`${label}: ${key} must be null or <=4000 chars`);
      if (key === 'source_ref') body[key] = value ? String(value).slice(0, 300) : null;
      else body[key] = value;
    }
    if (Object.hasOwn(u, 'apply_target') !== Object.hasOwn(u, 'staged_payload')) throw new Error(`${label}: apply_target and staged_payload must be set together`);
    Object.assign(body, stagedFields(u, label));
    const identity = id ? { id } : { dedupe_key: dedupe };
    return { json: { route: 'rest', method: 'PATCH', url: '/rest/v1/action_tracker?' + (id ? `id=eq.${id}` : `dedupe_key=eq.${encodeURIComponent(dedupe ?? '')}`), prefer: 'return=representation', body, identity, requested: 1, mode: 'UPDATE', key: id ?? dedupe } };
  });
}