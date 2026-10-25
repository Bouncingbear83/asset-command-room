
- Action surface routing (lanes, dedupe, rule checks) lives in pure functions in src/lib/actionSurface.ts with thresholds in src/config/signalRules.ts; UI components only render its output — keeps display rules testable and out of score/IRR-BB maths.
- Portfolio sheets are fetched once by src/data/PortfolioProvider.tsx (React Query) and read via usePortfolio(); each source reports ok/error/empty and panels on a non-ok source render NO DATA — no static fallbacks, so a failed fetch never shows as zero.
- Headline numbers (AUM, cash, gross DP, IRR-BB, asymmetry, band, tier) are read from the sheet via src/lib/canonical.ts; computeIrrBb survives only as a dev-mode cross-check — the app must not diverge from the sheet.
