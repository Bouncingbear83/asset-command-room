/**
 * Sprint A · A2 — BB basis classifier (OB §3.4.5i; same tests as Daily Run C30). Pure, display only.
 * First match wins. All tests are case-insensitive except T3's uppercase word PINNED.
 */
export type BbBasis = "V3A" | "V3A-NAV" | "PINNED-V1" | "LEGACY" | "UNKNOWN";
export interface BbBasisResult { cls: BbBasis; test: "T1" | "T2" | "T3" | "T4" | "T5"; source: "SCORES" | "VAULT"; needsVault?: boolean }

const T1 = /BB_ENGINE:\s*v3a/i;
const T3_ENGINE = /BB_ENGINE:\s*v3(?!a)/i;
const T3_WORD = /\bPINNED\b/; // case-sensitive on purpose: lowercase "pinned" in a path must not trip it
const isNav = (s: string) => /NAV_ENGINE:/i.test(s) && /v3a-nav-pinned/i.test(s);
const isNonScore = (s: string) => /cosmetic|stub fill/i.test(s) || (/unchanged/i.test(s) && /composite/i.test(s));
const vaultHasToken = (b: string) => T1.test(b) || isNav(b) || /V3A RC \d+/i.test(b);

/** vaultBody: undefined = not fetched (T4 → UNKNOWN, needsVault); null = fetch failed / no note / beyond cap. */
export function bbBasis(changeNote: string | null | undefined, vaultBody?: string | null): BbBasisResult {
  const s = String(changeNote ?? "");
  if (T1.test(s)) return { cls: "V3A", test: "T1", source: "SCORES" };
  if (isNav(s)) return { cls: "V3A-NAV", test: "T2", source: "SCORES" };
  if (T3_ENGINE.test(s) || T3_WORD.test(s)) return { cls: "PINNED-V1", test: "T3", source: "SCORES" };
  if (isNonScore(s)) {
    if (vaultBody && vaultHasToken(vaultBody)) return { cls: "V3A", test: "T4", source: "VAULT" };
    return { cls: "UNKNOWN", test: "T4", source: "VAULT", needsVault: vaultBody === undefined };
  }
  return { cls: "LEGACY", test: "T5", source: "SCORES" };
}

/** Vault path for a ticker note: tickers/{ticker lower, dots to dashes}.md */
export const tickerNotePath = (ticker: string) => `tickers/${ticker.trim().toLowerCase().replace(/\./g, "-")}.md`;

export const isV3a = (c: BbBasis | undefined) => c === "V3A" || c === "V3A-NAV";
export const isLintBasis = (c: BbBasis | undefined) => c === "PINNED-V1" || c === "LEGACY";
export const basisLintBadge = (c: BbBasis) => `BASIS LINT: ${c}: information only (OB §3.4.5i)`;
export const BASIS_UNVERIFIED = "BASIS UNVERIFIED";
export const basisTagText = (c: BbBasis) => (c === "V3A-NAV" ? "V3A·NAV" : c === "UNKNOWN" ? "?" : c);
