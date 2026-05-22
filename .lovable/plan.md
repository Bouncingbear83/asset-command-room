## Plan: unfreeze ticker fact sheet open

The symptom is now clearer: clicking any ticker, including RKLB, shows no slide-over and makes the page unresponsive. The prior `DialogTitle` fix did not address the actual failure.

### 1. Confirm the actual freeze path
- Reproduce the ticker click from the unlocked app in the browser debugger.
- Use console/network/performance profiling around the click to identify whether the lock happens in:
  - Radix `Sheet` focus/portal/body-lock behavior,
  - factsheet data fetch/render,
  - the price chart/heavy sections,
  - or a click-handler/render loop.

### 2. Make opening non-blocking and fail-safe
- Change `FactSheetProvider` so a ticker click only stores the selected ticker and opens a lightweight shell immediately.
- Defer expensive factsheet sections until after the shell has mounted.
- Ensure the close action works even while data is still loading.

### 3. Remove the likely modal/focus trap bottleneck if profiling confirms it
- If Radix `Sheet` is the freeze point, keep the shadcn-compatible styling but replace the factsheet usage with a controlled fixed-position slide-over shell for this feature only.
- This avoids focus trapping/body pointer locking while preserving the same 640px right panel design and close behavior.
- Do not change other shadcn Sheet components in the app.

### 4. Reduce heavy first render
- Render header + price strip first.
- Gate chart, rationale history, disruption blocks, and long text sections behind loading/ready checks.
- Keep existing data sources and response shapes unchanged.

### 5. Validate
- Click RKLB and at least one holding ticker.
- Confirm the panel opens, the app remains interactive, close works, and no blocking console errors appear.
- If any long task remains, use the profiler output to target the specific component.