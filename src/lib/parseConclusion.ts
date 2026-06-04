/**
 * Extracts a conclusion/action token from a research report's summary or HTML.
 * Tokens (case-insensitive, word-bounded). First match wins; summary preferred.
 */
const TOKENS = ["BUY", "ADD", "DEPLOY", "WAIT", "HOLD", "TRIM", "SELL", "EXIT", "PAUSE"] as const;
export type Conclusion = (typeof TOKENS)[number];

const RE = new RegExp(`\\b(${TOKENS.join("|")})\\b`, "i");

export function parseConclusion(summary?: string | null, html?: string | null): Conclusion | null {
  for (const src of [summary, html]) {
    if (!src) continue;
    // Strip tags for HTML fallback
    const text = src.replace(/<[^>]+>/g, " ");
    const m = text.match(RE);
    if (m) return m[1].toUpperCase() as Conclusion;
  }
  return null;
}

export function conclusionColor(c: Conclusion | null): string {
  if (!c) return "var(--text-dim)";
  if (c === "BUY" || c === "ADD" || c === "DEPLOY") return "var(--green)";
  if (c === "WAIT" || c === "HOLD") return "var(--gold)";
  return "var(--red)"; // TRIM / SELL / EXIT / PAUSE
}
