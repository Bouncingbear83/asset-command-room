import type { z } from "zod";

/**
 * A Supabase response-like envelope. Works for both PostgREST query builders
 * and rpc() results, which share this shape.
 */
export interface SupabaseLike<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * A parsed Supabase row-array response. `rows` is always a real array
 * (never undefined) so callers can pass it straight to `setState`.
 */
export interface ParsedRows<T> {
  rows: T[];
  invalid: number;
  error: string | null;
}

/**
 * Runs a Zod schema across a Supabase row-array response.
 *
 * - Supabase error → returns `{ rows: [], invalid: 0, error }`
 * - `data` missing / not an array → returns `{ rows: [], invalid: 0, error: null }`
 * - Per-row parse failure → row dropped, `invalid` incremented, warning logged
 *
 * Callers should check `error` and render accordingly; on success they can
 * consume `rows` directly with no further casting.
 */
export function parseRows<S extends z.ZodTypeAny>(
  schema: S,
  res: SupabaseLike<unknown>,
  label = "rows",
): ParsedRows<z.infer<S>> {
  if (res?.error) {
    return { rows: [], invalid: 0, error: res.error.message };
  }
  const data = res?.data;
  if (!Array.isArray(data)) {
    return { rows: [], invalid: 0, error: null };
  }
  const rows: z.infer<S>[] = [];
  let invalid = 0;
  for (const raw of data) {
    const r = schema.safeParse(raw);
    if (r.success) rows.push(r.data);
    else invalid++;
  }
  if (invalid > 0 && typeof console !== "undefined") {
    console.warn(`[safeRows:${label}] dropped ${invalid}/${data.length} invalid row(s)`);
  }
  return { rows, invalid, error: null };
}
