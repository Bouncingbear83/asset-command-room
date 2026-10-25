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