// Earnings-engine staging fields on action_tracker. Both or neither; v1 payload object up to 32 KB.
export const APPLY_TARGETS = ['UPDATE_ROW', 'RC_QUEUE', 'TRADE_TICKET', 'NONE'];
export const STAGED_MAX_BYTES = 32768;

/** Returns {} when neither field is present, else both validated fields (nulls clear both). */
export function stagedFields(row: Record<string, unknown>, label: string): Record<string, unknown> {
  const hasT = row.apply_target !== undefined, hasP = row.staged_payload !== undefined;
  if (!hasT && !hasP) return {};
  const t = row.apply_target ?? null, p = row.staged_payload ?? null;
  if ((t === null) !== (p === null)) throw new Error(`${label}: apply_target and staged_payload must be set together`);
  if (t === null) return { apply_target: null, staged_payload: null };
  if (typeof t !== 'string' || !APPLY_TARGETS.includes(t)) throw new Error(`${label}: apply_target must be UPDATE_ROW|RC_QUEUE|TRADE_TICKET|NONE`);
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error(`${label}: staged_payload must be an object`);
  if ((p as Record<string, unknown>).v !== 1) throw new Error(`${label}: staged_payload.v must be 1`);
  if (new TextEncoder().encode(JSON.stringify(p)).length > STAGED_MAX_BYTES) throw new Error(`${label}: staged_payload exceeds 32 KB`);
  return { apply_target: t, staged_payload: p };
}
