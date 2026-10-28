// Single source of truth for numeric (Asian-exchange) ticker detection and
// free-text naming. Display only — never use these to change keys or data.

/** Whole-string numeric ticker, e.g. 6951.T, 105840.KS, 0700.HK. */
export const NUMERIC_TICKER = /^\d{3,6}[A-Z]?\.(T|KS|KQ|TW|TWO|HK|SS|SZ)$/i;

/** Numeric ticker embedded in free text. Skips paths, URLs, query params and already-parenthesised codes. */
export const NUMERIC_TICKER_IN_TEXT = /(?<![A-Za-z0-9.\-\/=(_])(\d{3,6}[A-Z]?\.(?:T|KS|KQ|TW|TWO|HK|SS|SZ))(?![A-Za-z0-9])/g;

/** Back-compat alias for the old export name. */
export const IS_NUMERIC_TICKER = NUMERIC_TICKER;

export function isNumericTicker(t: string | null | undefined): boolean {
  return NUMERIC_TICKER.test(String(t ?? "").trim());
}

/** Abbreviate a company name: "Stella Chemifa Corporation" → "Stella Chemifa". */
export function shortName(name: string): string {
  const stripped = name
    .replace(/\b(Corporation|Corp\.?|Co\.?\s*,?\s*Ltd\.?|Ltd\.?|Inc\.?|Holdings|Group|Industries|Incorporated|plc|PLC|AG|SE|SA|NV|KK|Co\.?\s*Ltd\.?)\b/gi, "")
    .replace(/[,.]$/g, "")
    .trim();
  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length === 0) return name.split(/\s+/)[0] || name;
  if (words.length === 1) return words[0];
  if (words[0].length <= 3 && words.length >= 2) return `${words[0]} ${words[1]}`;
  if (words[0].length + words[1].length <= 16) return `${words[0]} ${words[1]}`;
  return words[0];
}

export type NameLookup = Map<string, string>;

function lookup(names: NameLookup, code: string): string | undefined {
  return names.get(code.toUpperCase().trim());
}

/** "JEOL (6951.T)" for numeric tickers with a known name; the code otherwise. */
export function tickerDisplay(ticker: string, names: NameLookup, name?: string | null): string {
  if (!isNumericTicker(ticker)) return ticker;
  const n = (name && name.trim()) || lookup(names, ticker);
  return n ? `${shortName(n)} (${ticker})` : ticker;
}

/**
 * Rewrite every bare numeric code in free text to "ShortName (code)".
 * Leaves codes already preceded by their name, and paths/URLs, untouched.
 * Unknown codes are kept as-is and passed to onMissing.
 */
export function withNames(text: string | null | undefined, names: NameLookup, onMissing?: (code: string) => void): string {
  const s = String(text ?? "");
  if (!s) return s;
  return s.replace(NUMERIC_TICKER_IN_TEXT, (match, code: string, offset: number) => {
    // Skip anything inside a URL token.
    const tokenStart = s.lastIndexOf(" ", offset) + 1;
    const token = s.slice(tokenStart, offset);
    if (/:\/\/|www\./i.test(token)) return match;
    const full = lookup(names, code);
    if (!full) { onMissing?.(code); return match; }
    const short = shortName(full);
    const before = s.slice(Math.max(0, offset - full.length - 3), offset).toLowerCase();
    if (before.includes(short.toLowerCase())) return match;
    return `${short} (${code})`;
  });
}
