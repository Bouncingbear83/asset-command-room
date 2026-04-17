

## Audit & Fix: Claude Deep-Link Consistency

### Problem
Claude links across the dashboard use **three different URL patterns** and **two different project IDs** — some don't reach the correct Stellar project, some don't pre-fill prompts properly.

### Current state

| File | Project ID | URL pattern | Issue |
|---|---|---|---|
| `CommandTab.tsx` | `019ca3a9…` (correct) | `claude.ai/new?q=…&project_uuid=…` | Uses `/new` route, not `/project/<id>` |
| `ScoresTab.tsx` | `019ca3a9…` (correct) | `claude.ai/project/<id>?prompt=…` | ✅ matches user spec |
| `HoldingsTab.tsx` | `019ca3a9…` (correct) | `claude.ai/project/<id>?prompt=…` | ✅ matches user spec |
| `WatchlistTab.tsx` | `019ca3a9…` (correct) | `claude.ai/new?q=…&project_uuid=…` | Uses `/new` route |
| `ReviewQueue.tsx` | `be2a318a…` ❌ **WRONG** (Lovable project ID, not Claude project ID) | `claude.ai/project/<id>#…` | Wrong project + uses `#hash` not `?prompt=` |

### Standardisation
Per user spec, every Claude button should use:
```
https://claude.ai/project/019ca3a9-aefe-77ea-af76-db62fd96f4e1?prompt=<URL_ENCODED_PROMPT>
```
Opened via `(window.top || window).open(url, '_blank')` (iframe CSP bypass — already a project rule).

### Changes

**1. `src/components/CommandTab.tsx`** — Rewrite `getClaudeUrl`:
```ts
function getClaudeUrl(prompt: string) {
  const base = `https://claude.ai/project/${PROJECT_ID}`;
  return prompt ? `${base}?prompt=${encodeURIComponent(prompt)}` : base;
}
```

**2. `src/components/WatchlistTab.tsx`** (line ~241) — Replace:
```ts
const url = `https://claude.ai/project/019ca3a9-aefe-77ea-af76-db62fd96f4e1?prompt=${encodeURIComponent(prompt)}`;
```

**3. `src/components/ReviewQueue.tsx`** — Two fixes:
- Change project ID from `be2a318a-707e-4e8d-ae4b-23f3eab50633` (Lovable ID — wrong) to `019ca3a9-aefe-77ea-af76-db62fd96f4e1` (Stellar Claude project).
- Replace the `#${ticker}-${prefix}` hash anchor (does nothing useful in Claude) with a proper pre-filled prompt, e.g.:
  ```ts
  const prompt = `Review flag ${flag.prefix} on ${flag.ticker}. Reason: ${flag.reason || '—'}. Reassess thesis and produce Research Commit.`;
  const url = `${CLAUDE_PROJECT_URL}?prompt=${encodeURIComponent(prompt)}`;
  ```

**4. `ScoresTab.tsx` & `HoldingsTab.tsx`** — Already correct, no changes.

**5. Memory** — Update `mem://features/claude-integration-strategy` to record the canonical URL pattern (`/project/<id>?prompt=…`) so future buttons stay consistent.

### Files touched
- `src/components/CommandTab.tsx`
- `src/components/WatchlistTab.tsx`
- `src/components/ReviewQueue.tsx`
- `.lovable/memory/features/claude-integration-strategy.md`

### Expected result
Every Claude button in the app opens the **Stellar Claude project** (`019ca3a9…`) with the relevant prompt pre-filled in the chat box, ready to send.

