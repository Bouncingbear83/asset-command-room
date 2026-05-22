## Plan: unfreeze Holding Fact Sheet open

The failure is happening at the shadcn/Radix Sheet boundary: clicking a ticker sets the sheet open, but the content is missing the required accessible title/description. The browser reports `DialogContent requires a DialogTitle`, and the app appears to hang before the sheet is usable.

### 1. Patch the Sheet content accessibility contract
- Update `HoldingFactSheet.tsx` to import and render `SheetTitle` and `SheetDescription` inside `SheetContent`.
- Keep them visually hidden so the current compact custom header remains unchanged.
- Use the ticker/name as the title and a short fact-sheet description for screen readers.

### 2. Reduce first-open render pressure
- Keep the sheet responsive by rendering the shell/header immediately.
- Gate the heavy sections behind the existing loading state where appropriate, especially price chart/history, so opening does not block on database fetches.
- Ensure the sheet can close even if fact-sheet data is still loading.

### 3. Validate the click path
- Re-run the ticker click flow in the preview.
- Confirm: ticker click opens the slide-over, no `DialogTitle` error remains, and the app remains interactive.