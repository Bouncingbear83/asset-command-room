
## Fix: Quick Commands still blocked in preview

### What’s happening
The current `window.top.open(...)` change is already present in `src/components/CommandTab.tsx`, but the screenshot shows it still fails in the preview. That means this is not just a bad `window.open` call anymore; it is a browser/iframe restriction issue. Claude blocks being opened from this embedded preview context, so the current JS launcher is still too fragile.

### Plan

**1. Replace the JS popup approach with real external links**
- In `src/components/CommandTab.tsx`, stop relying on `launchClaude()` for the quick command buttons.
- Generate the Claude URL with a helper, then render each command as:
  - an `<a href=... target="_blank" rel="noopener noreferrer">`
  - styled exactly like the current buttons
- Do the same for the “Open Stellar Intelligence” action.

Why: a real anchor click is more reliable than `window.open()` inside embedded contexts.

**2. Add a preview-safe fallback UX**
- Detect when the app is running inside an iframe (`window.self !== window.top`, guarded with try/catch).
- When embedded, show a small inline note above Quick Commands explaining that external tools may be blocked in preview and open reliably from the published site.
- Add a secondary “Copy prompt” action for each command so the user can still use the prompt even if the external site blocks.

Why: even a proper external link can still be affected by sandbox rules in preview, so the page needs a graceful fallback instead of a broken flow.

**3. Keep URL generation centralized**
- Refactor `launchClaude` into a pure URL builder like `getClaudeUrl(prompt: string)`.
- Reuse that helper for:
  - quick command links
  - open-Claude action
  - any custom prompt launcher already on the page

Why: one source of truth avoids another partial fix.

**4. Verify all Claude launch points**
- Search `CommandTab.tsx` for every Claude action and convert all of them consistently.
- Ensure there is no remaining `window.open()` path for Claude launch actions.

### Files
- `src/components/CommandTab.tsx` — replace popup launcher with anchor-based external links, add iframe note and copy fallback

### Validation
- In preview: clicking a Quick Command should no longer navigate the iframe to a blocked page; instead it should attempt a new tab and still leave the dashboard intact.
- In preview: copy fallback should work.
- On the published URL: Quick Commands should open Claude normally in a new tab.
