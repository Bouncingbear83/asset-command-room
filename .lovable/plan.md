
Goal

Remove the legacy Intelligence context completely and make sheet-backed portfolio data the only source for Index, Monitor, and Layers.

What I found

- `src/App.tsx` still wraps everything in `IntelligenceProvider`.
- `src/pages/Index.tsx`, `src/components/MonitorTab.tsx`, and `src/components/LayersTab.tsx` still call `useIntelligence()`.
- `src/data/intelligenceState.tsx` and `src/utils/parseIntelligenceUpdate.ts` are only used by that legacy path.
- `usePortfolioData()` already exposes `narrative`, but:
  - it does not currently fetch `MACRO_STATE`
  - its `parseNarrative()` still assumes key/value rows, while your architecture now uses a wide-row `NARRATIVE` sheet
- `MonitorTab` and `LayersTab` still contain static/fallback logic from the old intelligence model.

Implementation plan

1. Remove the provider layer
- Delete `IntelligenceProvider` from `src/App.tsx`.
- Render the app directly inside `QueryClientProvider`/`TooltipProvider`.

2. Replace `useIntelligence()` in `Index`
- Remove the import and `intel` usage from `src/pages/Index.tsx`.
- Source the macro banner from `usePortfolioData()` instead.
- If needed, pass parsed `macroState` / `narrative` data down as props rather than re-fetching in child components.

3. Extend `usePortfolioData()` to be the real source of truth
- Add `macroState` fetching to `src/hooks/usePortfolioData.ts`.
- Replace the current `parseNarrative()` with wide-row parsing for `NARRATIVE!A1:Z2`:
  - row 1 = field names
  - row 2 = values
- Add parsed outputs for the `MACRO_STATE` sections used by the UI:
  - macro banner metrics
  - risk controls
  - bubble flags
  - weekly triggers
- Export typed fields so components can consume them directly, not via any local intelligence state.

4. Refactor `MonitorTab` off the legacy layer
- Remove `useIntelligence()` from `src/components/MonitorTab.tsx`.
- Remove old intelligence-derived fallbacks and map the UI to `usePortfolioData()` outputs:
  - cost curves / structural items from `monitor`
  - weekly triggers from parsed `macroState`
  - narrative subtitles from parsed `narrative`
- Keep display-only empty states if sheet data is missing, but no JSON/local fallback source.

5. Refactor `LayersTab` off the legacy layer
- Remove `useIntelligence()` from `src/components/LayersTab.tsx`.
- Replace `state.layerGaps` and `state.ipoWatch` usage with sheet-backed data only:
  - layer gaps from `layers`
  - narrative copy from `narrative`
  - pre-IPO watch from `watchlist` rows filtered by status
- Remove hardcoded intelligence fallback entries.

6. Delete the legacy intelligence files
- Delete `src/data/intelligenceState.tsx`.
- Delete `src/utils/parseIntelligenceUpdate.ts` if nothing else references its types/functions after the refactor.

Design notes

- I would keep a single `usePortfolioData()` call at the page level and pass only the needed parsed data into tabs. That avoids duplicate sheet fetches and fits the current structure.
- I would not introduce any replacement context, reducer, local storage, or JSON parser.
- If sheet fields are absent, components should render “no live data” style UI rather than silently falling back to stale intelligence snapshots.

Files affected

- `src/App.tsx`
- `src/hooks/usePortfolioData.ts`
- `src/pages/Index.tsx`
- `src/components/MonitorTab.tsx`
- `src/components/LayersTab.tsx`
- delete `src/data/intelligenceState.tsx`
- delete `src/utils/parseIntelligenceUpdate.ts`

Acceptance criteria

- No `IntelligenceProvider` import or wrapper remains.
- No `useIntelligence()` calls remain anywhere.
- No local intelligence state, localStorage hydration, or JSON parsing path remains.
- Index, Monitor, and Layers render from `usePortfolioData()` only.
- `NARRATIVE` and `MACRO_STATE` are parsed in the hook and consumed by the UI.
