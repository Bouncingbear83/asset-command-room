import { object, text, optionalFields, number, isoDate } from '../_shared/tracker-validation.ts';

export function buildVaultRows(input: unknown) {
  const body = object(input, 'body');
  if (!Array.isArray(body.rows) || body.rows.length > 50) throw new Error('VAULT_META_UPSERT needs 0-50 rows');
  return body.rows.map((value, index) => {
    const row = object(value, `row ${index}`);
    const path = text(row.path, 'path', 300, 1);
    if (!path.endsWith('.md') || path.includes('..')) throw new Error('path must end .md and contain no ..');
    const result: Record<string, unknown> = { path };
    optionalFields(row, result, { type: value => text(value, 'type', 40) }, false);
    optionalFields(row, result, {
      identifier: value => text(value, 'identifier', 200),
      title: value => text(value, 'title', 300),
      ticker: value => text(value, 'ticker', 20),
      frontmatter: value => object(value, 'frontmatter'),
      body_sections: value => object(value, 'body_sections'),
      body: value => {
        if (typeof value !== 'string') throw new Error('body must be a string or null');
        return value.length > 10000 ? value.slice(0, 10000) + '[truncated]' : value;
      },
    });
    return result;
  });
}

const STAGES = ['SIGNAL', 'FORMING', 'MAPPED', 'ACTIVE', 'RETIRE'];
const TRANSITIONS = ['SEED', 'TP1', 'TP2', 'TP3', 'TP4', 'TP5', 'NOPIPE', 'REOPEN', 'DEMOTE'];
const SOURCES = ['SESSION', 'AUTO', 'BACKFILL'];
function oneOf(value: unknown, label: string, allowed: string[]): string {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(`${label} must be ${allowed.join('|')}`);
  return value;
}
export function buildThemesHistoryRows(input: unknown) {
  const body = object(input, 'body');
  if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 50) throw new Error('THEMES_HISTORY_INSERT needs 1-50 rows');
  return body.rows.map((value, index) => {
    const row = object(value, `row ${index}`);
    const result: Record<string, unknown> = {
      theme_id: text(row.theme_id, 'theme_id', 80, 1),
      to_stage: oneOf(row.to_stage, 'to_stage', STAGES),
      transition: oneOf(row.transition, 'transition', TRANSITIONS),
      transitioned_on: isoDate(row.transitioned_on, 'transitioned_on'),
      source: row.source === undefined ? 'SESSION' : oneOf(row.source, 'source', SOURCES),
    };
    if (row.transition === 'SEED' && row.from_stage != null) throw new Error(`row ${index}: SEED has no from_stage`);
    optionalFields(row, result, {
      from_stage: value => oneOf(value, 'from_stage', STAGES),
      session_ref: value => text(value, 'session_ref', 60),
      sheet_row: value => { const n = number(value, 'sheet_row'); if (!Number.isInteger(n) || n < 2) throw new Error('sheet_row must be an integer >= 2'); return n; },
      note: value => text(value, 'note', 500),
    });
    return result;
  });
}

export function buildPositionArgs(input: unknown) {
  const body = object(input, 'body');
  const args = object(body.args, 'args');
  if (args.p_action !== 'UPSERT' && args.p_action !== 'DELETE') throw new Error('p_action must be UPSERT or DELETE');
  const result: Record<string, unknown> = {
    p_action: args.p_action, p_ticker: text(args.p_ticker, 'p_ticker', 20, 1),
  };
  if (args.p_action === 'UPSERT' && (args.p_price_at_first_add === undefined || args.p_price_at_first_add === null)) throw new Error('p_price_at_first_add required for UPSERT');
  if (args.p_price_at_first_add !== undefined) result.p_price_at_first_add = number(args.p_price_at_first_add, 'p_price_at_first_add');
  optionalFields(args, result, {
    p_pe_at_first_add: value => number(value, 'p_pe_at_first_add'),
    p_first_add_date: value => isoDate(value, 'p_first_add_date'),
    p_reclass_status: value => {
      if (!['PRE', 'IN_PROGRESS', 'COMPLETE', 'N/A'].includes(String(value)) || typeof value !== 'string') throw new Error('p_reclass_status must be PRE|IN_PROGRESS|COMPLETE|N/A or null');
      return value;
    },
  });
  return result;
}