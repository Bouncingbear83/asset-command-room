// Parse "ENTRY TARGET" strings into a numeric [low, high] zone.
// Examples handled:
//   "$32-40", "$32–40", "32 to 40"      → low=32, high=40
//   "¥2200-2500"                        → low=2200, high=2500
//   "420-450p"                          → low=420, high=450
//   "<$35"                              → low=0, high=35
//   ">£2"                               → low=2, high=2
//   "$45"                               → low=45, high=45 (single value)
//   ""                                  → null
//
// `triggerPriceNumeric` is used as a fallback for `high` when only a single
// number can be extracted, or when the string is empty/garbage.

export interface EntryZone {
  low: number;
  high: number;
}

const NUM_RE = /-?\d+(?:[.,]\d+)?/g;

export function parseEntryTarget(
  raw: string | null | undefined,
  triggerPriceNumeric?: number | null,
): EntryZone | null {
  const str = (raw ?? "").trim();

  // Pull all numeric tokens (commas stripped → "2,500" → 2500)
  const tokens = str.match(NUM_RE)?.map((t) => parseFloat(t.replace(/,/g, ""))) ?? [];
  const valid = tokens.filter((n) => Number.isFinite(n) && n > 0);

  if (valid.length === 0) {
    if (triggerPriceNumeric != null && triggerPriceNumeric > 0) {
      return { low: triggerPriceNumeric, high: triggerPriceNumeric };
    }
    return null;
  }

  if (valid.length === 1) {
    const n = valid[0];
    // "<$35" → cap; ">£2" → floor
    if (/^\s*</.test(str)) return { low: 0, high: n };
    if (/^\s*>/.test(str)) return { low: n, high: triggerPriceNumeric ?? n };
    // Single price: treat as exact target; allow trigger fallback to widen
    if (triggerPriceNumeric != null && triggerPriceNumeric > 0 && triggerPriceNumeric !== n) {
      const lo = Math.min(n, triggerPriceNumeric);
      const hi = Math.max(n, triggerPriceNumeric);
      return { low: lo, high: hi };
    }
    return { low: n, high: n };
  }

  // 2+ numbers → take min/max of first two
  const a = valid[0];
  const b = valid[1];
  return { low: Math.min(a, b), high: Math.max(a, b) };
}
